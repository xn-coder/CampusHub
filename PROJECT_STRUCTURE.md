# 🌳 CampusHub Project Structure

Here is a visual overview of the folder and file structure for the CampusHub application.

```
.
├── 📁 public/
│   └── 🖼️ logo.png
├── 📁 src/
│   ├── 📁 actions/
│   │   └── ⚡ leaveActions.ts
│   ├── 📁 ai/
│   │   ├── 📂 flows/
│   │   │   └── 🧠 leave-application-approval.ts
│   │   ├── ⚙️ dev.ts
│   │   └── ⚙️ genkit.ts
│   ├── 📁 app/
│   │   ├── 📂 (app)/ (Authenticated Routes)
│   │   │   ├── 📂 admin/
│   │   │   │   ├── 📄 academic-years/
│   │   │   │   ├── 📄 admissions/
│   │   │   │   ├── 📄 attendance/
│   │   │   │   ├── 📄 class-schedule/
│   │   │   │   ├── 📄 lms/
│   │   │   │   ├── 📄 manage-students/
│   │   │   │   ├── 📄 manage-teachers/
│   │   │   │   ├── 📄 reports/
│   │   │   │   ├── 📄 student-fees/
│   │   │   │   ├── 📄 student-scores/
│   │   │   │   └── 📄 subjects/
│   │   │   ├── 📂 student/
│   │   │   │   ├── 📄 assignments/
│   │   │   │   ├── 📄 attendance-history/
│   │   │   │   ├── 📄 leave-history/
│   │   │   │   ├── 📄 lms/
│   │   │   │   ├── 📄 my-profile/
│   │   │   │   ├── 📄 my-scores/
│   │   │   │   ├── 📄 payment-history/
│   │   │   │   └── 📄 subjects/
│   │   │   ├── 📂 teacher/
│   │   │   │   ├── 📄 assignment-history/
│   │   │   │   ├── 📄 attendance/
│   │   │   │   ├── 📄 grade-assignments/
│   │   │   │   ├── 📄 id-card-printing/
│   │   │   │   ├── 📄 leave-requests/
│   │   │   │   ├── 📄 my-classes/
│   │   │   │   ├── 📄 my-students/
│   │   │   │   ├── 📄 post-assignments/
│   │   │   │   ├── 📄 profile/
│   │   │   │   ├── 📄 register-student/
│   │   │   │   └── 📄 reports/
│   │   │   ├── 📂 superadmin/
│   │   │   │   ├── 📄 create-school/
│   │   │   │   └── 📄 manage-school/
│   │   │   ├── 📄 calendar-events/
│   │   │   ├── 📄 class-management/
│   │   │   ├── 📄 communication/
│   │   │   ├── 📄 dashboard/
│   │   │   ├── 📄 leave-application/
│   │   │   ├── 📄 school-details/
│   │   │   └── ✨ layout.tsx
│   │   ├── 📂 (auth)/ (Authentication Routes)
│   │   │   ├── 📂 login/
│   │   │   │   ├── 📄 actions.ts
│   │   │   │   └── 📄 page.tsx
│   │   │   └── ✨ layout.tsx
│   │   ├── 📂 api/
│   │   │   └── ⚡ send-email/ (Deprecated)
│   │   ├── 🎨 globals.css
│   │   ├── ✨ layout.tsx
│   │   └── 📄 page.tsx (Root page, redirects to /login)
│   ├── 📁 components/
│   │   ├── 📂 layout/
│   │   │   ├── 🧩 app-layout.tsx
│   │   │   └── 🧩 sidebar-nav.tsx
│   │   ├── 📂 leave-application/
│   │   │   └── 🧩 leave-form.tsx
│   │   ├── 📂 shared/
│   │   │   ├── 🧩 id-card-preview.tsx
│   │   │   └── 🧩 page-header.tsx
│   │   ├── 📂 ui/ (ShadCN Components)
│   │   │   └── 🧩 ...
│   │   └── ⚙️ theme-provider.tsx
│   ├── 📁 hooks/
│   │   ├── ⚙️ use-mobile.tsx
│   │   └── ⚙️ use-toast.ts
│   ├── 📁 lib/
│   │   ├── ⚙️ supabaseClient.ts
│   │   └── ⚙️ utils.ts
│   ├── 📁 services/
│   │   └── 📧 emailService.ts
│   └── 📁 types/
│       └── 📜 index.ts
├── 📄 .env
├── 📄 next.config.ts
├── 📦 package.json
├── 📖 README.md
└── ⚙️ tsconfig.json
```

### Legend
-   `📁` - Directory
-   `📄` - Page Directory / Route Group
-   `✨` - Layout File
-   `🧩` - React Component
-   `⚙️` - Configuration / Utility File
-   `🎨` - Stylesheet
-   `⚡` - Server Action File
-   `🧠` - AI / Genkit Flow
-   `📧` - Email Service
-   `📜` - TypeScript Definitions
-   `📦` - Package Manifest
-   `📖` - Markdown Document
-   `🖼️` - Image Asset
