#!/bin/bash

echo "开始构建Hugo博客..."

# 清理public目录
rm -rf public

# 构建网站
hugo --minify

echo "构建完成！"
echo "网站文件已生成到public目录"
echo ""
echo "部署到GitHub Pages:"
echo "1. cd public"
echo "2. git init"
echo "3. git add ."
echo "4. git commit -m 'Deploy Hugo site'"
echo "5. git branch -M main"
echo "6. git remote add origin https://github.com/lwlwilliam/lwlwilliam.github.io.git"
echo "7. git push -f origin main"
echo ""
echo "或者使用gh-pages分支:"
echo "git subtree push --prefix public origin gh-pages"