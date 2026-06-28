#!/bin/bash
echo "تهيئة مستودع Git..."
git init --initial-branch=main

echo "ضبط إعدادات المستخدم..."
git config --local user.name "Marwan-Ghazy"
git config --local user.email "marwan-ghazy@creativepoint.local"

echo "إضافة المسار البعيد (Origin)..."
git remote add origin git@git.sofa.io:sofachat/web/plugins/jira.git || git remote set-url origin git@git.sofa.io:sofachat/web/plugins/jira.git

echo "إضافة الملفات..."
git add .

echo "تأكيد التغييرات..."
git commit -m "Initial commit - Complete Jira Plugin with Responsive UI"

echo "رفع الملفات إلى GitLab..."
git push --set-upstream origin main

echo "تم الرفع بنجاح!"
