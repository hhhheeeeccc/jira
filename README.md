# Jira Plugin - إدارة المشاريع لبلاجن workspace

بلاجن workspace لإدارة المشاريع والمهام بأسلوب كانبان (Jira-style).

## الميزات

- **إدارة المشاريع**: إنشاء وتعديل وحذف المشاريع (مع إمكانية تقييد الإنشاء للمسؤولين فقط من إعدادات الإضافة).
- **إدارة الأعضاء**: إضافة مستخدمي workspace كمشاركين في المشاريع أو إزالتهم.
- **إدارة المهام**: إنشاء مهام مع أولوية، تاريخ، ومسؤول وتفاصيل إضافية.
- **إدارة الأعمدة (جديد)**: تخصيص مساحة العمل عبر إنشاء، تعديل، وحذف أعمدة الكانبان بشكل ديناميكي.
- **كانبان بورد**: عرض المهام على شكل بطاقات مع إمكانية السحب والإفلات لنقل المهام بين الأعمدة.

## المتطلبات

- Go 1.21+
- Node.js 18+
- Make

## البناء والتشغيل

```bash
# تثبيت المتطلبات للواجهة
make setup

# بناء ملف التوزيع (يُنشئ dist/jira-plugin-1.0.0.tar.gz)
make dist

# بناء السيرفر فقط (باكند)
make server

# بناء الواجهة فقط (فرونت إند)
make webapp
```

## التثبيت على workspace (Mattermost)

1. شغّل `make dist` لإنشاء ملف `.tar.gz`
2. ارفع الملف من **System Console > Plugins > Management > Upload Plugin**
3. فعّل الإضافة من نفس القائمة.

## هيكل المشروع

```text
├── plugin.json          # بيانات البلاجن والإعدادات
├── Makefile             # أوامر البناء
├── go.mod               # تبعيات Go
├── server/              # كود Go (باكند البلاجن)
│   ├── main.go          # نقطة الدخول
│   ├── plugin.go        # تنفيذ البلاجن + API routes
│   └── store/           # قاعدة بيانات SQLite
│       ├── store.go     # تهيئة DB + migration
│       ├── project.go   # CRUD للمشاريع والأعضاء
│       ├── column.go    # CRUD للأعمدة
│       └── task.go      # CRUD للمهام
└── webapp/              # واجهة React
    ├── package.json
    ├── webpack.config.js
    └── src/
        ├── index.tsx        # نقطة الدخول
        ├── register.tsx     # تسجيل المكونات والأيقونات
        ├── api/client.ts    # دوال الاتصال بالسيرفر
        ├── store/useStore.ts # إدارة الحالة عبر Zustand
        ├── types/index.ts   # أنواع TypeScript
        ├── components/      # مكونات React (النوافذ المنبثقة، البطاقات، الأعمدة)
        └── styles/main.css  # التنسيقات العامة
```

## API Routes

كل الـ routes تحت `/plugins/com.workspace.plugin.jira/api/v1/`:

| Method | Route | الوصف |
|--------|-------|-------|
| GET    | `/me` | بيانات المستخدم الحالي وصلاحياته |
| GET    | `/projects` | قائمة المشاريع |
| POST   | `/projects` | إنشاء مشروع |
| GET    | `/projects/{id}` | تفاصيل مشروع |
| DELETE | `/projects/{id}` | حذف مشروع |
| GET    | `/projects/{id}/members` | قائمة أعضاء المشروع |
| POST   | `/projects/{id}/members` | إضافة أعضاء للمشروع |
| DELETE | `/projects/{id}/members/{userId}` | إزالة عضو من المشروع |
| GET    | `/projects/{id}/columns` | قائمة الأعمدة الخاصة بالمشروع |
| POST   | `/projects/{id}/columns` | إضافة عمود جديد للمشروع |
| PATCH  | `/columns/{id}` | تعديل بيانات عمود (الاسم/اللون) |
| DELETE | `/columns/{id}` | حذف عمود |
| GET    | `/projects/{id}/tasks` | قائمة المهام الخاصة بالمشروع |
| POST   | `/projects/{id}/tasks` | إنشاء مهمة جديدة |
| PATCH  | `/tasks/{id}` | تحديث تفاصيل مهمة أو نقلها لعمود آخر |
| DELETE | `/tasks/{id}` | حذف مهمة |
| GET    | `/users` | جلب قائمة بمستخدمي workspace |