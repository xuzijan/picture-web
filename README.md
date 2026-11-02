# Frameflow 图片筛选台

本地第一版原型，包含：

- 最新图片优先的响应式瀑布流
- 点击图片进入大图预览
- 单张图片的「认可 / 不认可」记录（本地浏览器保存）
- 管理员入口的单张或批量图片上传
- 精选标记和精选筛选

## 启动

```bash
npm install
npm run dev
```

打开 http://localhost:3000 。当前版本使用浏览器 localStorage 保存演示数据，方便先看交互效果。接入生产环境时，将上传文件放到 Cloudflare R2 / S3 / Cloudinary，将图片元数据与投票写入 MongoDB，并在登录层接入 Clerk GitHub OAuth。
