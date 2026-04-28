# 推送到 GitHub 指南

本地 Git 仓库已初始化并完成首次提交（`7361db1`，99 个文件）。

## 最后一步：创建 GitHub 仓库并推送

### 方法 A：命令行一键完成（推荐）

在 PowerShell 中执行以下命令，将 `YOUR_USERNAME` 和 `REPO_NAME` 替换为你的信息：

```powershell
cd D:\Code\best_exam_scheduler\exam-scheduler

# 1. 添加远程仓库（HTTPS 方式）
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# 2. 推送到 GitHub（首次推送需要输入 GitHub 用户名和个人访问令牌）
git push -u origin master
```

> 如果 GitHub 要求密码，请输入你的 **Personal Access Token**（不是登录密码）。
> 令牌创建地址：https://github.com/settings/tokens

### 方法 B：通过 GitHub 网页创建仓库后再推送

1. 打开 https://github.com/new
2. 填写 Repository name（建议：`exam-scheduler`）
3. 选择 **Public** 或 **Private**
4. **不要**勾选 "Initialize this repository with a README"（本地已有）
5. 点击 **Create repository**
6. 在出现的页面中复制 "…or push an existing repository from the command line" 下方的命令：

```powershell
cd D:\Code\best_exam_scheduler\exam-scheduler
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

### 方法 C：如果已安装 GitHub CLI (gh)

```powershell
cd D:\Code\best_exam_scheduler\exam-scheduler
gh repo create REPO_NAME --public --source=. --push
```

---

## 验证推送成功

```powershell
git log --oneline --graph --decorate --all
```

应看到：
```
* 7361db1 (HEAD -> master, origin/master) feat: complete exam scheduler...
```

---

## 推送后操作

- 访问 `https://github.com/YOUR_USERNAME/REPO_NAME` 查看代码
- 在仓库 Settings → Pages 中可配置 GitHub Pages（如需静态预览）
