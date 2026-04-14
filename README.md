# Site（色色猫娘聊天）

这是我自己在用的一个聊天小网页，界面是类似 ChatGPT 的简洁风格，没有左边那栏历史记录，看起来会更清爽（因为没有服务器给你存）。

## 这个项目能干嘛

- 打开网页就能直接聊天
- 回车就发送，Shift + 回车换行
- 手机和电脑都能用
- 发消息的时候会有“思考中...”提示

## 怎么用

1. 把项目下到本地。
2. 直接打开 [index.html](index.html)。
3. 在输入框里打字，点发送就行。

## 提示（缺陷）

实际请求由其他网站接收，因此需要魔法上网，不然会fail to fetch。

## 项目结构（不是，这有什么必要吗）

```text
Site/
├─ index.html
├─ README.md
├─ vercel.json
├─ api/
│  └─ chat.js
├─ docs/
│  ├─ system_setting.txt
│  └─ welcomes.txt
├─ pics/
│  ├─ egg/
│  │  └─ Priestess.jpg
│  └─ profile/
│     ├─ vanilla.png
│     └─ Priestess.jpg
└─ sound/
   └─ Priestess.m4a
```

## 后面可能会加的东西

- 关键词识别触发
- 新建会话按钮
- 聊天记录保存
- 深色模式