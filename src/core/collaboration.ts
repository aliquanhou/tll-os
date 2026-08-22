/**
 * TLL OS - Multi-Agent Collaboration Implementation
 *
 * P0-2: ChangeSet
 * P0-3: Workspace
 * P0-4: Resource Lock / Version
 * P0-5: Agent Handoff
 * P0-6: Review / Merge
 *
 * 这些是 TLL OS 与普通 Web 框架的核心区别：
 * 多个 Agent 可以在同一 Application 上安全协作。
 */

import type {
  Application,
  GraphSnapshot,
  ChangeEntry, ChangeOperation, ChangeEntityType,
  RuntimeChangeSet, ChangeSetStatus, ChangeSetPreview, ChangeSetValidationResult, ChangeSetApplyResult, ChangeSetSnapshot, ChangeSetManager,
  Workspace, WorkspaceStatus, WorkspaceManager,
  ResourceLock, LockManager, VersionConflictError,
  AgentHandoff, HandoffStatus, HandoffManager,
  ReviewRequest, ReviewStatus, ReviewComment, MergeRequest, MergeStatus, ReviewManager,
} from '../public/types.js';

import { createTllOS } from './index.js';

// ============================================================
// 工具函数
// ============================================================

let collabIdCounter = 0;
function generateCollabId(prefix: string): string {
  collabIdCounter++;
  return `${prefix}_${Date.now().toString(36)}_${collabIdCounter}`;
}

function now(): number {
  return Date.now();
}

// ============================================================
// P0-2: ChangeSet 实现
// ============================================================

class RuntimeChangeSetImpl implements RuntimeChangeSet {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly agentName?: string;
  readonly workspaceId?: string;
  status: ChangeSetStatus = 'draft';
  readonly createdAt: number;
  updatedAt: number;

  entries: ChangeEntry[] = [];
  dependencies: string[] = [];
  affectedNodeIds: string[] = [];
  riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

  // 应用前的 Graph 快照（用于 rollback）
  private snapshotBefore?: GraphSnapshot;
  // 引用主 Application（用于 apply）
  private application?: Application;

  constructor(name: string, options?: { description?: string; agentName?: string; workspaceId?: string }) {
    this.id = generateCollabId('cs');
    this.name = name;
    this.description = options?.description;
    this.agentName = options?.agentName;
    this.workspaceId = options?.workspaceId;
    this.createdAt = now();
    this.updatedAt = now();
  }

  setApplication(app: Application): void {
    this.application = app;
  }

  addEntry(entry: Omit<ChangeEntry, 'id' | 'timestamp'>): void {
    const fullEntry: ChangeEntry = {
      ...entry,
      id: generateCollabId('ce'),
      timestamp: now(),
    };
    this.entries.push(fullEntry);
    if (entry.entityId) this.affectedNodeIds.push(entry.entityId);
    this.updatedAt = now();
    this.status = 'draft';
  }

  preview(): ChangeSetPreview {
    const byOperation: Record<ChangeOperation, number> = { add: 0, modify: 0, remove: 0 };
    const byEntityType: Record<string, number> = {};
    const affectedModules = new Set<string>();
    const affectedApis = new Set<string>();
    const affectedTools = new Set<string>();
    const affectedTests = new Set<string>();
    const conflicts: string[] = [];

    for (const entry of this.entries) {
      byOperation[entry.operation]++;
      byEntityType[entry.entityType] = (byEntityType[entry.entityType] ?? 0) + 1;
      if (entry.entityType === 'module') affectedModules.add(entry.entityName ?? entry.entityId);
      if (entry.entityType === 'api') affectedApis.add(entry.entityName ?? entry.entityId);
      if (entry.entityType === 'tool') affectedTools.add(entry.entityName ?? entry.entityId);
      if (entry.entityType === 'test') affectedTests.add(entry.entityName ?? entry.entityId);
    }

    const totalChanges = this.entries.length;
    const estimatedRisk: 'low' | 'medium' | 'high' | 'critical' =
      totalChanges === 0 ? 'low' :
      totalChanges >= 15 || byOperation.remove > 5 ? 'critical' :
      totalChanges >= 8 || byOperation.remove > 0 ? 'high' :
      totalChanges >= 3 ? 'medium' : 'low';

    this.riskLevel = estimatedRisk;

    return {
      totalChanges,
      byOperation,
      byEntityType,
      affectedModules: Array.from(affectedModules),
      affectedApis: Array.from(affectedApis),
      affectedTools: Array.from(affectedTools),
      affectedTests: Array.from(affectedTests),
      estimatedRisk,
      conflicts,
    };
  }

  validate(): ChangeSetValidationResult {
    const errors: Array<{ entryId?: string; message: string; code: string }> = [];
    const warnings: Array<{ entryId?: string; message: string }> = [];
    const requiresTests: string[] = [];

    if (this.entries.length === 0) {
      errors.push({ message: 'ChangeSet is empty', code: 'EMPTY_CHANGESET' });
    }

    // 检查重复实体 ID（同一实体多次修改）
    const entityCounts = new Map<string, number>();
    for (const entry of this.entries) {
      const key = `${entry.entityType}:${entry.entityId}`;
      entityCounts.set(key, (entityCounts.get(key) ?? 0) + 1);
      if (entry.operation === 'modify' && !entry.after) {
        warnings.push({ entryId: entry.id, message: `Modify entry for ${entry.entityType}:${entry.entityId} has no "after" data` });
      }
      if (entry.operation === 'remove' && !entry.before) {
        warnings.push({ entryId: entry.id, message: `Remove entry for ${entry.entityType}:${entry.entityId} has no "before" data` });
      }
      // API/Tool/Module 变更需要测试
      if (['api', 'tool', 'module'].includes(entry.entityType)) {
        requiresTests.push(`${entry.entityType}:${entry.entityName ?? entry.entityId}`);
      }
    }

    for (const [key, count] of entityCounts) {
      if (count > 1) {
        warnings.push({ message: `Entity ${key} modified ${count} times in this ChangeSet` });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      requiresTests: [...new Set(requiresTests)],
    };
  }

  async apply(): Promise<ChangeSetApplyResult> {
    if (!this.application) {
      return { success: false, appliedCount: 0, failedCount: this.entries.length, errors: [{ entryId: '', message: 'No application reference set' }] };
    }

    const validation = this.validate();
    if (!validation.valid) {
      this.status = 'conflict';
      return { success: false, appliedCount: 0, failedCount: this.entries.length, errors: validation.errors.map(e => ({ entryId: e.entryId ?? '', message: e.message })) };
    }

    // 保存快照用于 rollback
    this.snapshotBefore = this.application.graph.toJSON();
    this.status = 'validated';

    let appliedCount = 0;
    let failedCount = 0;
    const errors: Array<{ entryId: string; message: string }> = [];

    // 按顺序应用变更（PoC：记录变更，实际应用逻辑由 Workspace Merge 处理）
    for (const entry of this.entries) {
      try {
        // 变更已在 Workspace 的 Application 中执行，这里只记录
        appliedCount++;
      } catch (error) {
        failedCount++;
        errors.push({ entryId: entry.id, message: error instanceof Error ? error.message : String(error) });
      }
    }

    this.status = appliedCount === this.entries.length ? 'applied' : 'conflict';
    this.updatedAt = now();

    return {
      success: failedCount === 0,
      appliedCount,
      failedCount,
      errors,
      newGraphSnapshot: this.application.graph.toJSON(),
    };
  }

  async rollback(): Promise<boolean> {
    if (!this.application || !this.snapshotBefore) {
      return false;
    }
    // PoC：rollback 标记状态，实际恢复由 Workspace 处理
    this.status = 'rolled_back';
    this.updatedAt = now();
    return true;
  }

  toJSON(): ChangeSetSnapshot {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      agentName: this.agentName,
      workspaceId: this.workspaceId,
      entries: this.entries,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

class ChangeSetManagerImpl implements ChangeSetManager {
  private changeSets: Map<string, RuntimeChangeSetImpl> = new Map();
  private application?: Application;

  setApplication(app: Application): void {
    this.application = app;
  }

  create(name: string, options?: { description?: string; agentName?: string; workspaceId?: string }): RuntimeChangeSet {
    const cs = new RuntimeChangeSetImpl(name, options);
    if (this.application) cs.setApplication(this.application);
    this.changeSets.set(cs.id, cs);
    return cs;
  }

  get(id: string): RuntimeChangeSet | null {
    return this.changeSets.get(id) ?? null;
  }

  list(status?: ChangeSetStatus): RuntimeChangeSet[] {
    const all = Array.from(this.changeSets.values());
    return status ? all.filter(cs => cs.status === status) : all;
  }

  listByWorkspace(workspaceId: string): RuntimeChangeSet[] {
    return Array.from(this.changeSets.values()).filter(cs => cs.workspaceId === workspaceId);
  }

  listByAgent(agentName: string): RuntimeChangeSet[] {
    return Array.from(this.changeSets.values()).filter(cs => cs.agentName === agentName);
  }

  remove(id: string): void {
    this.changeSets.delete(id);
  }
}

// ============================================================
// P0-4: Resource Lock 实现
// ============================================================

class ResourceLockImpl implements ResourceLock {
  readonly id: string;
  readonly resourceId: string;
  readonly resourceType: ChangeEntityType;
  readonly ownerAgent: string;
  readonly version: number;
  readonly acquiredAt: number;
  expiresAt: number;
  status: 'active' | 'expired' | 'released' = 'active';

  constructor(resourceId: string, resourceType: ChangeEntityType, ownerAgent: string, version: number, ttlMs: number) {
    this.id = generateCollabId('lock');
    this.resourceId = resourceId;
    this.resourceType = resourceType;
    this.ownerAgent = ownerAgent;
    this.version = version;
    this.acquiredAt = now();
    this.expiresAt = now() + ttlMs;
  }

  isExpired(): boolean {
    return now() > this.expiresAt || this.status !== 'active';
  }

  release(): void {
    this.status = 'released';
  }

  extend(ttlMs: number): void {
    this.expiresAt = now() + ttlMs;
  }
}

class LockManagerImpl implements LockManager {
  private locks: Map<string, ResourceLockImpl> = new Map();
  private versions: Map<string, number> = new Map();

  acquire(resourceId: string, resourceType: ChangeEntityType, agentName: string, ttlMs: number = 30000): ResourceLock {
    // 检查是否有活跃锁
    const existing = this.locks.get(resourceId);
    if (existing && !existing.isExpired() && existing.ownerAgent !== agentName) {
      const conflict: VersionConflictError = {
        code: 'VERSION_CONFLICT',
        resourceId,
        resourceType,
        expectedVersion: existing.version,
        actualVersion: this.getVersion(resourceId),
        ownerAgent: existing.ownerAgent,
        message: `Resource ${resourceId} is locked by ${existing.ownerAgent}`,
      };
      throw conflict;
    }

    const version = this.getVersion(resourceId);
    const lock = new ResourceLockImpl(resourceId, resourceType, agentName, version, ttlMs);
    this.locks.set(resourceId, lock);
    return lock;
  }

  release(lockId: string): boolean {
    for (const [resourceId, lock] of this.locks) {
      if (lock.id === lockId) {
        lock.release();
        this.locks.delete(resourceId);
        return true;
      }
    }
    return false;
  }

  get(resourceId: string): ResourceLock | null {
    const lock = this.locks.get(resourceId);
    if (lock && lock.isExpired()) {
      lock.status = 'expired';
      this.locks.delete(resourceId);
      return null;
    }
    return lock ?? null;
  }

  listActive(): ResourceLock[] {
    return Array.from(this.locks.values()).filter(l => !l.isExpired());
  }

  listByAgent(agentName: string): ResourceLock[] {
    return this.listActive().filter(l => l.ownerAgent === agentName);
  }

  checkVersion(resourceId: string, expectedVersion: number): { ok: boolean; actualVersion: number } {
    const actual = this.getVersion(resourceId);
    return { ok: actual === expectedVersion, actualVersion: actual };
  }

  incrementVersion(resourceId: string): number {
    const current = this.getVersion(resourceId);
    const next = current + 1;
    this.versions.set(resourceId, next);
    return next;
  }

  getVersion(resourceId: string): number {
    return this.versions.get(resourceId) ?? 0;
  }
}

// ============================================================
// P0-5: Agent Handoff 实现
// ============================================================

class AgentHandoffImpl implements AgentHandoff {
  readonly id: string;
  readonly fromAgent: string;
  readonly toAgent: string;
  readonly task: string;
  readonly description?: string;
  status: HandoffStatus = 'pending';
  readonly createdAt: number;
  updatedAt: number;

  readonly workspaceId?: string;
  readonly changeSetId?: string;
  graphSnapshot?: GraphSnapshot;
  unresolvedIssues: string[] = [];
  context: Record<string, unknown> = {};

  constructor(fromAgent: string, toAgent: string, task: string, options?: {
    description?: string;
    workspaceId?: string;
    changeSetId?: string;
    graphSnapshot?: GraphSnapshot;
    context?: Record<string, unknown>;
  }) {
    this.id = generateCollabId('handoff');
    this.fromAgent = fromAgent;
    this.toAgent = toAgent;
    this.task = task;
    this.description = options?.description;
    this.workspaceId = options?.workspaceId;
    this.changeSetId = options?.changeSetId;
    this.graphSnapshot = options?.graphSnapshot;
    this.context = options?.context ?? {};
    this.createdAt = now();
    this.updatedAt = now();
  }

  accept(): void {
    this.status = 'accepted';
    this.updatedAt = now();
  }

  reject(reason: string): void {
    this.status = 'rejected';
    this.context.rejectReason = reason;
    this.updatedAt = now();
  }

  complete(summary: string): void {
    this.status = 'completed';
    this.context.completionSummary = summary;
    this.updatedAt = now();
  }

  addIssue(issue: string): void {
    this.unresolvedIssues.push(issue);
    this.updatedAt = now();
  }
}

class HandoffManagerImpl implements HandoffManager {
  private handoffs: Map<string, AgentHandoffImpl> = new Map();

  create(fromAgent: string, toAgent: string, task: string, options?: {
    description?: string;
    workspaceId?: string;
    changeSetId?: string;
    graphSnapshot?: GraphSnapshot;
    context?: Record<string, unknown>;
  }): AgentHandoff {
    const handoff = new AgentHandoffImpl(fromAgent, toAgent, task, options);
    this.handoffs.set(handoff.id, handoff);
    return handoff;
  }

  get(id: string): AgentHandoff | null {
    return this.handoffs.get(id) ?? null;
  }

  list(status?: HandoffStatus): AgentHandoff[] {
    const all = Array.from(this.handoffs.values());
    return status ? all.filter(h => h.status === status) : all;
  }

  listByAgent(agentName: string): AgentHandoff[] {
    return Array.from(this.handoffs.values()).filter(h => h.fromAgent === agentName || h.toAgent === agentName);
  }

  listIncoming(agentName: string): AgentHandoff[] {
    return Array.from(this.handoffs.values()).filter(h => h.toAgent === agentName);
  }

  listOutgoing(agentName: string): AgentHandoff[] {
    return Array.from(this.handoffs.values()).filter(h => h.fromAgent === agentName);
  }

  remove(id: string): void {
    this.handoffs.delete(id);
  }
}

// ============================================================
// P0-6: Review / Merge 实现
// ============================================================

class ReviewRequestImpl implements ReviewRequest {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly author: string;
  readonly authorType: 'agent' | 'human';
  readonly changeSetId: string;
  readonly workspaceId?: string;
  status: ReviewStatus = 'pending';
  readonly createdAt: number;
  updatedAt: number;

  reviewers: Array<{ name: string; type: 'agent' | 'human'; status: ReviewStatus }> = [];
  comments: ReviewComment[] = [];

  constructor(title: string, author: string, authorType: 'agent' | 'human', changeSetId: string, options?: {
    description?: string;
    workspaceId?: string;
  }) {
    this.id = generateCollabId('review');
    this.title = title;
    this.author = author;
    this.authorType = authorType;
    this.changeSetId = changeSetId;
    this.description = options?.description;
    this.workspaceId = options?.workspaceId;
    this.createdAt = now();
    this.updatedAt = now();
  }

  addReviewer(name: string, type: 'agent' | 'human'): void {
    if (!this.reviewers.find(r => r.name === name)) {
      this.reviewers.push({ name, type, status: 'pending' });
      this.updatedAt = now();
    }
  }

  addComment(author: string, authorType: 'agent' | 'human', content: string, changeEntryId?: string): ReviewComment {
    const comment: ReviewComment = {
      id: generateCollabId('comment'),
      author,
      authorType,
      content,
      createdAt: now(),
      changeEntryId,
    };
    this.comments.push(comment);
    this.updatedAt = now();
    return comment;
  }

  approve(reviewer: string): void {
    const r = this.reviewers.find(r => r.name === reviewer);
    if (r) {
      r.status = 'approved';
      this.updatedAt = now();
      // 如果所有 reviewer 都 approve，则整体 approve
      if (this.reviewers.length > 0 && this.reviewers.every(r => r.status === 'approved')) {
        this.status = 'approved';
      }
    }
  }

  reject(reviewer: string, reason: string): void {
    const r = this.reviewers.find(r => r.name === reviewer);
    if (r) {
      r.status = 'rejected';
      this.status = 'rejected';
      this.addComment(reviewer, r.type, `Rejected: ${reason}`);
      this.updatedAt = now();
    }
  }

  requestChanges(reviewer: string, reason: string): void {
    const r = this.reviewers.find(r => r.name === reviewer);
    if (r) {
      r.status = 'changes_requested';
      this.status = 'changes_requested';
      this.addComment(reviewer, r.type, `Changes requested: ${reason}`);
      this.updatedAt = now();
    }
  }
}

class MergeRequestImpl implements MergeRequest {
  readonly id: string;
  readonly title: string;
  readonly sourceWorkspaceId: string;
  readonly targetWorkspaceId: string;
  readonly changeSetId: string;
  readonly author: string;
  status: MergeStatus = 'pending';
  readonly createdAt: number;
  updatedAt: number;

  reviewRequestId?: string;
  conflictDetails?: string[];
  mergeResult?: ChangeSetApplyResult;

  constructor(title: string, sourceWorkspaceId: string, changeSetId: string, author: string, options?: {
    targetWorkspaceId?: string;
    reviewRequestId?: string;
  }) {
    this.id = generateCollabId('merge');
    this.title = title;
    this.sourceWorkspaceId = sourceWorkspaceId;
    this.targetWorkspaceId = options?.targetWorkspaceId ?? 'main';
    this.changeSetId = changeSetId;
    this.author = author;
    this.reviewRequestId = options?.reviewRequestId;
    this.createdAt = now();
    this.updatedAt = now();
  }

  approve(): void {
    this.status = 'approved';
    this.updatedAt = now();
  }

  reject(reason: string): void {
    this.status = 'rejected';
    this.conflictDetails = [reason];
    this.updatedAt = now();
  }

  async merge(): Promise<ChangeSetApplyResult> {
    if (this.status !== 'approved' && this.status !== 'pending') {
      return { success: false, appliedCount: 0, failedCount: 0, errors: [{ entryId: '', message: `Merge request is ${this.status}, cannot merge` }] };
    }

    this.status = 'merged';
    this.updatedAt = now();

    const result: ChangeSetApplyResult = {
      success: true,
      appliedCount: 0,
      failedCount: 0,
      errors: [],
    };
    this.mergeResult = result;
    return result;
  }
}

class ReviewManagerImpl implements ReviewManager {
  private reviews: Map<string, ReviewRequestImpl> = new Map();
  private merges: Map<string, MergeRequestImpl> = new Map();

  createReview(title: string, author: string, authorType: 'agent' | 'human', changeSetId: string, options?: {
    description?: string;
    workspaceId?: string;
  }): ReviewRequest {
    const review = new ReviewRequestImpl(title, author, authorType, changeSetId, options);
    this.reviews.set(review.id, review);
    return review;
  }

  getReview(id: string): ReviewRequest | null {
    return this.reviews.get(id) ?? null;
  }

  listReviews(status?: ReviewStatus): ReviewRequest[] {
    const all = Array.from(this.reviews.values());
    return status ? all.filter(r => r.status === status) : all;
  }

  createMerge(title: string, sourceWorkspaceId: string, changeSetId: string, author: string, options?: {
    targetWorkspaceId?: string;
    reviewRequestId?: string;
  }): MergeRequest {
    const merge = new MergeRequestImpl(title, sourceWorkspaceId, changeSetId, author, options);
    this.merges.set(merge.id, merge);
    return merge;
  }

  getMerge(id: string): MergeRequest | null {
    return this.merges.get(id) ?? null;
  }

  listMerges(status?: MergeStatus): MergeRequest[] {
    const all = Array.from(this.merges.values());
    return status ? all.filter(m => m.status === status) : all;
  }
}

// ============================================================
// P0-3: Workspace 实现
// ============================================================

class WorkspaceImpl implements Workspace {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly agentName: string;
  readonly baseGraphSnapshot: GraphSnapshot;
  status: WorkspaceStatus = 'active';
  readonly createdAt: number;
  updatedAt: number;

  readonly application: Application;
  readonly changeSets: ChangeSetManagerImpl;

  private currentChangeSet?: RuntimeChangeSetImpl;

  constructor(name: string, agentName: string, baseApp: Application, options?: { description?: string }) {
    this.id = generateCollabId('ws');
    this.name = name;
    this.agentName = agentName;
    this.description = options?.description;
    this.baseGraphSnapshot = baseApp.graph.toJSON();
    this.createdAt = now();
    this.updatedAt = now();

    // 创建独立的 Application 实例（基于主 Application 的配置）
    const tll = createTllOS();
    this.application = tll.createApplication({
      name: `${baseApp.name}-workspace-${this.id}`,
      version: baseApp.version,
      description: `Workspace ${name} for agent ${agentName}`,
    });

    this.changeSets = new ChangeSetManagerImpl();
    this.changeSets.setApplication(this.application);
  }

  createChangeSet(name: string, description?: string): RuntimeChangeSet {
    const cs = this.changeSets.create(name, {
      description,
      agentName: this.agentName,
      workspaceId: this.id,
    });
    this.currentChangeSet = cs as RuntimeChangeSetImpl;
    this.updatedAt = now();
    return cs;
  }

  getCurrentChangeSet(): RuntimeChangeSet | null {
    return this.currentChangeSet ?? null;
  }

  async commit(changeSetId: string): Promise<ChangeSetApplyResult> {
    const cs = this.changeSets.get(changeSetId);
    if (!cs) {
      return { success: false, appliedCount: 0, failedCount: 0, errors: [{ entryId: '', message: `ChangeSet ${changeSetId} not found` }] };
    }
    const result = await cs.apply();
    this.updatedAt = now();
    return result;
  }

  diff(): ChangeSetPreview {
    if (this.currentChangeSet) {
      return this.currentChangeSet.preview();
    }
    return {
      totalChanges: 0,
      byOperation: { add: 0, modify: 0, remove: 0 },
      byEntityType: {},
      affectedModules: [],
      affectedApis: [],
      affectedTools: [],
      affectedTests: [],
      estimatedRisk: 'low',
      conflicts: [],
    };
  }

  abandon(): void {
    this.status = 'abandoned';
    this.updatedAt = now();
  }
}

class WorkspaceManagerImpl implements WorkspaceManager {
  private workspaces: Map<string, WorkspaceImpl> = new Map();
  private mainApplication?: Application;

  setMainApplication(app: Application): void {
    this.mainApplication = app;
  }

  create(name: string, agentName: string, options?: { description?: string }): Workspace {
    if (!this.mainApplication) {
      throw new Error('Main application not set for WorkspaceManager');
    }
    const ws = new WorkspaceImpl(name, agentName, this.mainApplication, options);
    this.workspaces.set(ws.id, ws);
    return ws;
  }

  get(id: string): Workspace | null {
    return this.workspaces.get(id) ?? null;
  }

  getByName(name: string): Workspace | null {
    return Array.from(this.workspaces.values()).find(w => w.name === name) ?? null;
  }

  list(status?: WorkspaceStatus): Workspace[] {
    const all = Array.from(this.workspaces.values());
    return status ? all.filter(w => w.status === status) : all;
  }

  listByAgent(agentName: string): Workspace[] {
    return Array.from(this.workspaces.values()).filter(w => w.agentName === agentName);
  }

  getActiveWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values()).filter(w => w.status === 'active');
  }

  remove(id: string): void {
    this.workspaces.delete(id);
  }
}

// ============================================================
// 导出
// ============================================================

export {
  ChangeSetManagerImpl, RuntimeChangeSetImpl,
  WorkspaceManagerImpl, WorkspaceImpl,
  LockManagerImpl, ResourceLockImpl,
  HandoffManagerImpl, AgentHandoffImpl,
  ReviewManagerImpl, ReviewRequestImpl, MergeRequestImpl,
};
