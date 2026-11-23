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

打开 http://localhost:3000 。当前版本使用浏览器 localStorage 保存演示数据，方便先看交互效果。

## 生产接入准备

项目已经包含 Clerk、MongoDB Atlas 和 Vercel Blob 的服务端接口。复制 `.env.example` 为 `.env.local` 并填写对应的环境变量后：

- `GET /api/images`：读取最新图片与当前登录用户的投票
- `POST /api/upload`：登录用户批量上传图片到 Vercel Blob，并写入 MongoDB
- `PUT /api/images/:id/vote`：保存或取消当前用户对图片的认可判断
- `PUT /api/images/:id/feature`：登录用户设置精选状态
- `GET /api/download?id=...`：登录用户下载单张图片；传入多个 `id` 时打包为 ZIP 下载
- `DELETE /api/images/:id`：登录用户删除图片及其关联的投票、评论、分类关系和存储文件

`ADMIN_USER_IDS` 可选，用于显示管理员身份标识；上传和设置精选已对所有登录用户开放。当前页面仍保留本地演示数据，等 Clerk 和数据库变量配置完成后再切换到 API 数据源。

## 最新批次物体标签

图片详情下方显示中文主物体、副物体数量及名单。`lib/latest-batch-tags.json` 来自 2026-11-09 MOSS 翻新 100 例的 `plans.jsonl`，按对应原始 PNG 的 SHA-256 建索引（50 条无副物体，50 条一个副物体）。来源图集：https://ycn3t1n3rlnx.feishu.cn/wiki/IuKIw9cc9ipTJPkv61EcIacYnwh 。

登录后详情请求 `/api/images/:id/tags`，服务端读取数据库中的 Blob 原图并匹配文件指纹；不依据通用 sample 文件名猜测批次。不匹配的旧图不显示标签，重新压缩或修改过的文件也不会误匹配。查询结果有进程内缓存，不修改图片、投票或评论数据。

副物体数量筛选支持全部、0、1、2、3，可叠加分类、精选和名称搜索。未标注图片仅显示在全部中。首次筛选以四路并发解析标签，失败可重试；原图指纹写入数据库 subjectTagsHash，后续读取直接查标签清单。

标签性能更新：列表接口一并返回 subjectTags，详情及数量筛选直接使用内存数据。已有图片在首次加载时补齐指纹（有并发及时间上限，失败明确提示刷新），新上传图片直接计算指纹。已保存指纹的列表无需再下载原图。
