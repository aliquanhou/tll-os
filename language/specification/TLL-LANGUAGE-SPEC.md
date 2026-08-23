# TLL Language Specification v0.1

> 状态：DRAFT
> 日期：2026-08-23
> 目标：定义 TLL 应用编程语言的词法、语法和语义。

---

## 一、语言定位

TLL 是 Application-Native Language——为开发完整应用而设计的声明式优先编程语言。

TLL 不是通用编程语言，不追求图灵完备的算法表达能力。它专注于描述应用的结构、数据、接口、权限、工作流和智能体。

复杂算法逻辑通过 `action` 块中的嵌入式表达式语言实现，或通过外部 Adapter 调用。

---

## 二、词法结构

### 2.1 字符集

TLL 源文件使用 UTF-8 编码。

### 2.2 空白与注释

- 空白（空格、制表符、换行）用于分隔 token，无其他语义
- 单行注释：`// 注释内容`
- 多行注释：`/* 注释内容 */`

### 2.3 标识符

标识符用于命名 application、module、entity、field、api、action 等。

规则：
- 首字符：字母（a-z, A-Z）或下划线（_）
- 后续字符：字母、数字（0-9）、下划线
- 区分大小写
- 不能是关键字

### 2.4 关键字

```
application module entity field api action event
workflow view component agent tool permission
policy integration storage test deployment
identity users catalog orders on return assert
allow deny role import as from true false
null if else when match default setup action
```

### 2.5 字面量

- 字符串：双引号 `"hello"`，支持 `\n` `\t` `\\` `\"`
- 多行字符串：三个双引号 `""" ... """`
- 整数：`42` `-17`
- 浮点数：`3.14` `-0.5`
- 货币：`100.00 USD`
- 布尔：`true` `false`
- 空值：`null`

### 2.6 运算符

| 类别 | 运算符 |
|------|--------|
| 算术 | `+` `-` `*` `/` `%` |
| 比较 | `==` `!=` `<` `>` `<=` `>=` |
| 逻辑 | `&&` `||` `!` |
| 声明赋值 | `:` |
| 命令赋值 | `=` |
| 成员访问 | `.` |
| 调用 | `()` |
| 列表 | `[]` |

---

## 三、语法结构

### 3.1 顶层结构

TLL 应用由一个或多个 `.tll` 文件组成。每个文件可以包含一个或多个顶层块。

### 3.2 块（Block）

块是 TLL 的核心语法单元。块由块名、可选参数和花括号体组成。

```
blockName [parameters] {
    // 块内容：子块、声明、语句
}
```

块可以嵌套。

### 3.3 声明（Declaration）

```
declarationType Name {
    // 属性和子块
}
```

或简写：

```
declarationType Name: value
```

---

## 四、应用级块

### 4.1 application

```
application Commerce {
    identity {
        name: "TLL Commerce"
        version: "1.0.0"
    }
}
```

### 4.2 identity

应用元数据：name, version, description, author, license。

### 4.3 module

```
module Catalog {
    entity Product { ... }
    api GET "/products" { ... }
}
```

目录分区简写（等价于 module）：

```
catalog {
    entity Product { ... }
}
```

---

## 五、数据模型

### 5.1 entity

```
entity Product {
    id: uuid
    name: text
    price: money
    stock: integer
    createdAt: datetime
}
```

### 5.2 字段类型

uuid, text, integer, float, boolean, money, datetime, date, email, url, json, enum(...), relation(...), list(...)

### 5.3 字段修饰符

- `?`：可选（可空）
- `!`：必填（默认）
- `@unique`：唯一约束
- `@index`：索引
- `@default(value)`：默认值

---

## 六、API

```
api GET "/products" {
    description: "List all products"
    permission: product.read
    query { page?: integer limit?: integer }
    return Product.list(query)
}

api POST "/products" {
    permission: product.write
    body { name: text price: money stock: integer }
    return Product.create(body)
}

api GET "/products/:id" {
    params { id: uuid }
    return Product.findById(params.id)
}
```

HTTP 方法：GET POST PUT PATCH DELETE HEAD OPTIONS

---

## 七、Action

```
action placeOrder {
    permission: order.create
    input {
        customerId: uuid
        items: list({ productId: uuid, quantity: integer })
    }
    output { orderId: uuid total: money }
    logic {
        const order = Order.create({ customer: input.customerId })
        for item in input.items:
            OrderItem.create({ order: order.id, product: item.productId, quantity: item.quantity })
        return { orderId: order.id, total: order.total }
    }
}
```

---

## 八、Event

```
event OrderPaid {
    payload {
        orderId: uuid
        amount: money
        customerId: uuid
    }
}
```

---

## 九、Workflow

```
workflow OrderFulfillment {
    on OrderPaid

    step reserveStock {
        action: reserveInventory
        input: { orderId: event.orderId }
        onError: retry(3)
    }

    step createShipment {
        dependsOn: reserveStock
        action: createShipment
    }

    step notifyCustomer {
        dependsOn: createShipment
        action: sendEmail
    }
}
```

---

## 十、Agent

```
agent CustomerService {
    goal: "Resolve customer issues"
    tools: searchOrder createRefund
    permissions: order.read refund.create
    policy:
        neverDiscountAbove: 20%
}
```

---

## 十一、Tool

```
tool searchOrder {
    input {
        customerId?: uuid
        status?: enum(pending, paid, shipped)
    }
    output { orders: list(Order) total: integer }
    permission: order.read
    execute: Order.search(input)
}
```

---

## 十二、Permission & Role

```
permission product.read { description: "Read products" }

role Merchant {
    allow: product.read product.write order.read
    deny: product.delete
}
```

---

## 十三、View（UI）

```
view ProductList {
    layout: admin
    source: Product
    columns: name price stock status
    actions: create edit delete
    filters: category status
}
```

---

## 十四、Test

```
test "create product" {
    setup {
        create Category { name: "Electronics" }
    }
    action {
        create Product {
            name: "Demo"
            price: 99.99 USD
            stock: 100
        }
    }
    assert {
        Product.count() == 1
    }
}
```

---

## 十五、Deployment

```
deployment production {
    target: cloud
    database { type: postgresql version: "16" }
    domains: ["shop.example.com"]
    ssl: auto
}
```

---

## 十六、Integration

```
integration Stripe {
    type: payment
    adapter: stripe
    config { apiKey: "${STRIPE_API_KEY}" }
}
```

---

## 十七、Storage

```
storage default {
    type: postgresql
    connection: "${DATABASE_URL}"
}
```

---

## 十八、import

```
import "./modules/user.tll"
import "./modules/product.tll" as product
```

---

## 十九、嵌入式表达式语言

在 `logic`、`execute`、`assert` 块中使用：

- 变量：`const x = 10` `let y = "hello"`
- 条件：`if cond: ... else: ...`
- 循环：`for item in items: ...`
- 调用：`Product.create({...})`
- 返回：`return result`

---

## 二十、文件扩展名

- `.tll`：TLL 应用源文件
- `.tllir`：编译后的 TLL-IR JSON
- `.tllapp`：打包后的 TLL 应用

---

## 二十一、语法总结

```
application Name { identity { ... } }
module Name { entity/api/action/... }
entity Name { field: type @modifier }
api METHOD "/path" { params/query/body/return }
action Name { input/output/logic }
event Name { payload }
workflow Name { on Event, step Name { ... } }
agent Name { tools/permissions/policy }
tool Name { input/output/execute }
permission Name { ... }
role Name { allow/deny }
view Name { layout/source/columns }
test "desc" { setup/action/assert }
deployment Name { target/database/domains }
```

所有块都可以嵌套，所有声明都映射到 Application Graph 的节点和边。
