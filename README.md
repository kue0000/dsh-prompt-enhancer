# 提示词增强（dsh-prompt-enhancer）

在 DSH 的 AI 对话输入框里，把一段粗略草稿改写成更清晰、结构化、可直接发送的提示词。类似 WorkBuddy 的内置「增强提示词」：

- 输入框右侧工具行新增一个星形按钮，悬停提示「增强提示词」；
- 快捷键 `Ctrl+Shift+E`（macOS 为 `⌘⇧E`），在输入框有内容时可用；
- 打开对比面板：左侧原始提示词，右侧流式生成的增强版本；
- 支持**一键替换输入框**、**复制**、**重新生成**、**停止生成**；
- 增强结果可直接编辑，再决定是否替换；
- 使用当前会话选择的模型（未选择时回退到部署默认模型），不要求额外 API Key。

插件包名：`@local/dsh-prompt-enhancer`，版本 `1.0.0`，Host + Client bundle。

## 快速验收

1. 刷新 DSH 的 Web 页面（Client bundle 在页面加载时注册）。
2. 在输入框写一句话，右侧工具行应出现星形按钮；悬停显示「增强提示词」。
3. 点击按钮或按 `Ctrl+Shift+E`，等待右侧流式结果出现。
4. 试一次「替换输入框」和「复制」。

如果按钮没出现：到「设置 → 插件」确认 `提示词增强` 已启用，然后刷新页面；Host 路由已是 active 状态。

---

## 1. 使用

1. 在任意会话的输入框里写下提示词，例如：

   ```text
   帮我写一个关于城市更新的报告
   ```

2. 点击输入框右下方的星形按钮，或按 `Ctrl+Shift+E`。
3. 面板会一边生成一边显示结果。生成结束后：
   - **替换输入框**：把草稿替换成增强版本（写入纯文本，原草稿中的引用 chip 会被替换掉）；
   - **复制**：复制增强结果；
   - **重新生成**：对同一段原文再跑一次；
   - **停止**：中断当前生成，保留已生成的部分；
   - 右侧文本框可直接编辑，改完再替换。
4. 关闭面板不会发送消息；替换后需要你自己按 Enter 发送。

> 空草稿时按钮为禁用状态，快捷键也不会触发。
> 当前插槽是会话级的：新建会话的 Hero 输入框在绑定 Session 后出现按钮。

---

## 2. 它如何增强

Host 端使用 DSH 自己的 `ctx.llm` 服务，系统提示词要求模型：

- 保留原始意图、语言、语气和所有具体细节（名称、数字、路径、约束、示例）；
- 只补充能从原文或常识直接推出的上下文；缺少但必要的信息写成 `[请补充：…]` 占位符，不编造；
- 按需明确：任务目标、背景/上下文、约束条件、交付物与输出格式、质量标准、验收标准；
- 去掉空话和重复，短任务保持短，复杂任务才用 Markdown 标题/列表；
- 只输出增强后的提示词，不回答任务本身，不加解释。

默认输出结构会按任务自适应；例如上面的「城市更新报告」测试会生成报告范围、地域、读者、篇幅、结构、写作要求、输出格式，并把未知项标成待补充。

---

## 3. 技术结构

```text
dsh-prompt-enhancer/
├─ package.json          # bundle 清单：dsh.bundle.patch + dsh.client
├─ cordis.patch.yml      # insert: prompt-enhancer
├─ index.js              # Host：POST /prompt-enhancer/enhance，NDJSON 流
├─ client.js             # Client：conversation.input.right 按钮 + 对比面板
├─ locale/{zh,en}.json   # 插件 inventory 标题/描述
├─ icon.svg              # 原创图标
└─ README.md
```

### Host 路由

`POST /prompt-enhancer/enhance`

请求：

```json
{ "text": "原始提示词", "sessionId": "session-..." }
```

响应是 `application/x-ndjson`，逐行：

```json
{"type":"start","provider":"deepseek-account","model":"deepseek-flash"}
{"type":"delta","text":"请"}
{"type":"done","text":"完整增强结果","finish":"stop","truncated":false}
```

失败时：

```json
{"type":"error","error":"...","text":"已生成的部分（可能为空）"}
```

实现要点：

- 模型选择：先读 `agent.model.current()`（当前会话实际选择），再回退 `agentDefaultModel.currentSelection()`，也支持配置强制指定；
- 输入上限默认 8000 字，输出上限默认 1800 tokens，temperature 默认 0.35；
- 通过 `ctx.llm.stream()` 消费 token 级 `text-delta`，即时写给浏览器；
- 客户端关闭面板会 abort fetch，Host 同步 abort 模型流；
- 响应逐行 JSON，客户端用 `ReadableStream` + `TextDecoder` 解析，不依赖 WebSocket。

### 安全

- 路由在返回任何业务结果前调用 `ctx.connection.requestRejection({ headers })`，复用 DSH 的 Host/Origin 检查和浏览器签名 Cookie 认证；未认证请求返回 `401`。
- 额外要求 `x-dsh-prompt-enhancer: 1` 请求头，并检查 `Origin` 与 `Host` 同源、`sec-fetch-site` 为 `same-origin`；跨站表单/预检请求无法满足。
- 请求体上限 256 KiB，输入 8000 字上限，非 POST 返回 405，非 JSON 返回 415。

### 配置

默认无需配置。需要覆盖时，在 profile 的 `cordis.patch.yml` 里用同 `id` 覆盖：

```yaml
- id: prompt-enhancer
  name: '@local/dsh-prompt-enhancer'
  config:
    maxChars: 8000
    maxOutputTokens: 1800
    temperature: 0.35
    # 可选：强制使用指定模型，不跟随会话选择
    # provider: deepseek-account
    # model: deepseek-flash
```

| 键 | 默认 | 说明 |
|---|---|---|
| `maxChars` | 8000 | 原始提示词最大字符数（按 Unicode 码点） |
| `maxOutputTokens` | 1800 | 增强结果最大输出 token |
| `temperature` | 0.35 | 生成温度，0–2 |
| `maxBodyBytes` | 262144 | 请求体上限（字节） |
| `provider` / `model` | 跟随会话 | 强制指定模型；不设置则跟随当前会话/部署默认 |

---

## 4. 验证记录

本机实际执行：

| 检查 | 结果 |
|---|---|
| `node --check index.js` / `client.js` | 通过 |
| locale JSON / package.json / icon.svg | 合法 UTF-8 JSON / 合法 SVG |
| `plugin_manager install_bundle` | `application: applied`，bundle 安装成功 |
| `plugin_manager list_plugins` | `include:prompt-enhancer`，`fiberPhase: active` |
| `cordis_inspect_query Config.listConfigs` | 行 `include:prompt-enhancer` 存在 |
| `cordis_inspect_query Slots.listSubTree` | `conversation.input.right` 出现 `prompt-enhancer`，`active: true`（安装后、页面断开前的记录） |
| Host 路由真实调用（认证加入前） | 返回 `start` → 多条 `delta` → `done`；模型 `deepseek-account / deepseek-flash`，完整中文结构化结果 |
| Host 路由认证（当前代码） | 无 Cookie 的 `curl` 返回 `401 Unauthorized`；证明 `connection.requestRejection` 生效 |
| 方法守卫 | `GET` 返回 `405` |
| **浏览器视觉验证** | **未完成**：当前没有已连接的 Harness 页面，按插件技能约束不另起浏览器/不提取 token；按钮位置、弹窗排版、明暗主题需要刷新页面后人工确认 |

> 刷新页面后如果没看到星形按钮：确认「设置 → 插件」里 `提示词增强` 已启用；Client bundle 在页面加载时注册，Host 路由已处于 active 状态。

---

## 5. 已知边界

- 增强结果是模型生成的建议，不是事实核查；替换前请确认其中的假设与占位符。
- 替换使用 `inputActions.setDraft()` 写入纯文本，原草稿中的引用 chip / 引用块会被替换掉；附件不受影响。
- 依赖当前会话模型/部署凭据；没有可用模型或凭据失效时，面板会显示具体错误。
- 增强请求是 UI 辅助调用，不写入会话对话历史；不会触发 Agent 回合。
- 当前按钮位于会话级 `conversation.input.right`；没有绑定 Session 的空白 Hero 不显示。
- 未做浏览器自动化视觉验收（见上表），界面细节以实际页面为准。

---

## 6. 维护

- 修改 `client.js` 后，DSH 的 Client HMR 可能自动加载；若页面没变化，刷新页面。
- 修改 `index.js` 后，Host 模块需要重新加载：先 `remove_bundle` 再 `install_bundle`（本机验证此方式已让新的认证逻辑生效），或重启 DSH。
- 数据与隐私：增强请求会把你输入的草稿发送给当前会话使用的模型提供方；请勿在草稿中放置不希望发送的敏感信息。
