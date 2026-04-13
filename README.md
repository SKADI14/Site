# Site

这是我自己在用的一个聊天小网页，界面是那种 ChatGPT 的简洁风格，没有左边那栏历史记录，看起来会更清爽。

## 这个项目能干嘛

- 打开网页就能直接聊天
- 回车就发送，Shift + 回车换行
- 手机和电脑都能用
- 发消息的时候会有“思考中...”提示

## 怎么用

1. 把项目下到本地。
2. 直接打开 [index.html](index.html)。
3. 在输入框里打字，点发送就行。

## 小提醒

现在页面里默认连的是这个接口：

https://backend-lilac-alpha.vercel.app/api/chat

如果你有自己的后端，把 [index.html](index.html) 里的 `API_URL` 改掉就可以。

## 项目结构

```text
Site/
├─ index.html
├─ README.md
└─ api/
	 └─ chat.js
```

## 后面可以加的东西

- 随机欢迎语
- 新建会话按钮
- 聊天记录保存
- 更好看的消息样式（猫娘头像）
- 深色模式