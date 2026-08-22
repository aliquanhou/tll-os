/**
 * TLL OS - Plugin Implementation (P0-11)
 *
 * Plugin 最小实现：Manifest + 生命周期 + 权限。
 * 不包含 Plugin Marketplace / 远程 Registry。
 */

import type {
  PluginManifest, PluginInstance, PluginState, PluginManager,
  Application,
} from '../public/types.js';

function now(): number {
  return Date.now();
}

// ============================================================
// Plugin Instance 实现
// ============================================================

class PluginInstanceImpl implements PluginInstance {
  readonly manifest: PluginManifest;
  state: PluginState = 'installed';
  readonly installedAt: number;
  enabledAt?: number;

  private config: Record<string, unknown> = {};
  private application?: Application;

  constructor(manifest: PluginManifest, application?: Application) {
    this.manifest = manifest;
    this.installedAt = now();
    this.application = application;
  }

  async enable(): Promise<void> {
    if (this.state === 'enabled') return;
    if (this.state === 'error') throw new Error(`Plugin "${this.manifest.name}" is in error state`);

    // 检查依赖
    if (this.manifest.dependencies && this.application) {
      for (const _dep of this.manifest.dependencies) {
        // 依赖检查由 PluginManager 在 enable 时处理
      }
    }

    this.state = 'enabled';
    this.enabledAt = now();

    // 触发 plugin.enabled 事件
    if (this.application) {
      await this.application.events.dispatch('plugin.enabled', { plugin: this.manifest.name });
    }
  }

  async disable(): Promise<void> {
    if (this.state !== 'enabled') return;
    this.state = 'disabled';

    if (this.application) {
      await this.application.events.dispatch('plugin.disabled', { plugin: this.manifest.name });
    }
  }

  async uninstall(): Promise<void> {
    if (this.state === 'enabled') {
      await this.disable();
    }
    this.state = 'installed';

    if (this.application) {
      await this.application.events.dispatch('plugin.uninstalled', { plugin: this.manifest.name });
    }
  }

  getConfig(): Record<string, unknown> {
    return { ...this.config };
  }

  setConfig(key: string, value: unknown): void {
    this.config[key] = value;
  }
}

// ============================================================
// Plugin Manager 实现
// ============================================================

export class PluginManagerImpl implements PluginManager {
  private plugins: Map<string, PluginInstanceImpl> = new Map();
  private application?: Application;

  setApplication(app: Application): void {
    this.application = app;
  }

  async install(manifest: PluginManifest): Promise<PluginInstance> {
    if (this.plugins.has(manifest.name)) {
      throw new Error(`Plugin "${manifest.name}" is already installed`);
    }

    const plugin = new PluginInstanceImpl(manifest, this.application);
    this.plugins.set(manifest.name, plugin);

    if (this.application) {
      await this.application.events.dispatch('plugin.installed', { plugin: manifest.name });
    }

    return plugin;
  }

  async uninstall(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    await plugin.uninstall();
    this.plugins.delete(name);
    return true;
  }

  async enable(name: string): Promise<PluginInstance | null> {
    const plugin = this.plugins.get(name);
    if (!plugin) return null;

    // 检查依赖是否已启用
    if (plugin.manifest.dependencies) {
      for (const dep of plugin.manifest.dependencies) {
        const depPlugin = this.plugins.get(dep);
        if (!depPlugin || depPlugin.state !== 'enabled') {
          throw new Error(`Plugin "${name}" requires "${dep}" to be enabled first`);
        }
      }
    }

    await plugin.enable();
    return plugin;
  }

  async disable(name: string): Promise<PluginInstance | null> {
    const plugin = this.plugins.get(name);
    if (!plugin) return null;

    // 检查是否有其他启用的插件依赖它
    for (const [otherName, other] of this.plugins) {
      if (otherName !== name && other.state === 'enabled' && other.manifest.dependencies?.includes(name)) {
        throw new Error(`Cannot disable "${name}": "${otherName}" depends on it`);
      }
    }

    await plugin.disable();
    return plugin;
  }

  get(name: string): PluginInstance | null {
    return this.plugins.get(name) ?? null;
  }

  list(state?: PluginState): PluginInstance[] {
    const all = Array.from(this.plugins.values());
    return state ? all.filter(p => p.state === state) : all;
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }
}
