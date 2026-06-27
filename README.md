# Jira Plugin - إدارة المشاريع لبلاجن Mattermost

بلاجن Mattermost لإدارة المشاريع والمهام بأسلوب كانبان (Jira-style).

## الميزات

- **إدارة المشاريع**: إنشاء وحذف المشاريع
- **إدارة الأعضاء**: إضافة مستخدمي Mattermost كمشاركين في المشاريع
- **إدارة المهام**: إنشاء مهام مع أولوية وتاريخ ومسؤول
- **كانبان بورد**: 4 أعمدة (الخلفية، قيد التنفيذ، جاري العمل، مكتمل)
- **سحب وإفلات**: نقل المهام بين الأعمدة

## المتطلبات

- Go 1.21+
- Node.js 18+
- Make

## البناء والتشغيل

```bash
# تثبيت المتطلبات
make setup

# بناء ملف التوزيع (يُنشئ dist/jira-plugin-1.0.0.tar.gz)
make dist

# أو بناء السيرفر فقط للجهاز الحالي
make server-dev

# بناء الواجهة فقط
make webapp
```

## التثبيت على Mattermost

1. شغّل `make dist` لإنشاء ملف `.tar.gz`
2. ارفع الملف من **System Console > Plugins > Management > Upload Plugin**
3. فعّل البلاجن

## هيكل المشروع

```
├── plugin.json          # بيانات البلاجن
├── Makefile             # أوامر البناء
├── go.mod               # تبعيات Go
├── server/              # كود Go (باكند البلاجن)
│   ├── main.go          # نقطة الدخول
│   ├── plugin.go        # تنفيذ البلاجن + API routes
│   └── store/           # قاعدة بيانات SQLite
│       ├── store.go     # تهيئة DB + migration
│       ├── project.go   # CRUD للمشاريع والأعضاء
│       └── task.go      # CRUD للمهام
└── webapp/              # واجهة React
    ├── package.json
    ├── webpack.config.js
    └── src/
        ├── index.tsx        # تسجيل البلاجن
        ├── register.tsx     # registerRootComponent
        ├── api/client.ts    # API client
        ├── store/useStore.ts # Zustand state
        ├── types/index.ts   # TypeScript types
        ├── components/      # مكونات React
        └── styles/main.css  # تنسيقات
```

## API Routes

كل الـ routes تحت `/plugins/com.mattermost.plugin.jira/api/v1/`:

| Method | Route | الوصف |
|--------|-------|-------|
| GET | /projects | قائمة المشاريع |
| POST | /projects | إنشاء مشروع |
| GET | /projects/{id} | تفاصيل مشروع |
| DELETE | /projects/{id} | حذف مشروع |
| POST | /projects/{id}/members | إضافة أعضاء |
| DELETE | /projects/{id}/members/{userId} | إزالة عضو |
| GET | /projects/{id}/tasks | قائمة المهام |
| POST | /projects/{id}/tasks | إنشاء مهمة |
| PATCH | /tasks/{id} | تحديث مهمة |
| DELETE | /tasks/{id} | حذف مهمة |
| GET | /users | مستخدمي Mattermost |