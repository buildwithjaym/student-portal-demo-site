# <div align="center">🟢🟡 Student Portal</div>

<div align="center">

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Geist\&weight=700\&size=26\&pause=1000\&color=166534\&center=true\&vCenter=true\&width=700\&lines=Online+Grade+Management+System;Built+for+Students%2C+Teachers%2C+and+Administrators;Secure%2C+Modern%2C+and+Scalable)](https://git.io/typing-svg)

<br />

<img src="./public/logo.jpg" alt="Qorban Portal Logo" width="120" />

<br /><br />

![Next.js](https://img.shields.io/badge/Next.js-15-166534?style=for-the-badge\&logo=nextdotjs\&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-14532D?style=for-the-badge\&logo=typescript\&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20DB-166534?style=for-the-badge\&logo=supabase\&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-Styled-15803D?style=for-the-badge\&logo=tailwindcss\&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-854D0E?style=for-the-badge\&logo=vercel\&logoColor=white)

<br />

![Status](https://img.shields.io/badge/Status-Active-success?style=flat-square)
![Maintenance](https://img.shields.io/badge/Maintained-Yes-22c55e?style=flat-square)
![License](https://img.shields.io/badge/Use-Educational%20%26%20Institutional-ca8a04?style=flat-square)

</div>

---

## 📚 Overview

**Student Portal** is a modern **Online Grade Management System** built to streamline academic workflows for **students, teachers, and administrators**.

It provides a secure, role-based platform for:

* 📊 Viewing and managing grades
* 👤 Managing user accounts and profiles
* 🔐 Enforcing password-change flows
* 🏫 Organizing academic data in a clean, responsive interface

Built with modern technologies like **Next.js, Supabase, TypeScript, and Tailwind CSS**, the system is scalable, secure, and production-ready.

---

## ✨ Key Features

### 🔐 Authentication & Security

* Secure login using **Supabase Auth**
* Role-based authentication (Admin / Teacher / Student)
* Forced password change for new users
* Forgot password & recovery system
* Account activation control (`is_active`)
* Session-based redirection

### 👥 Role-Based Access

* 🧑‍💼 Admin Dashboard
* 👨‍🏫 Teacher Dashboard
* 🎓 Student Dashboard

Each role is automatically redirected after login.

---

### 🧾 User Management

* Centralized **profiles table (Supabase)**
* Linked with `auth.users`
* Supports:

  * `must_change_password`
  * `is_active`
  * role-based access control

---

### 🎨 User Experience

* Clean **green & gold Qorban branding**
* Fully responsive design
* Modern UI components
* Smooth transitions and clean layouts

---

### 🌐 SEO & Search Visibility

* Google Search Console verified ✅
* Sitemap configured
* Metadata optimized
* Public homepage for indexing (SEO-friendly)

---

### 📈 Analytics

* Vercel Analytics ready
* Track page visits and user activity

---

## 🛠 Tech Stack

| Category       | Technology           |
| -------------- | -------------------- |
| Framework      | Next.js (App Router) |
| Language       | TypeScript           |
| Styling        | Tailwind CSS         |
| Backend        | Supabase             |
| Authentication | Supabase Auth        |
| Database       | PostgreSQL           |
| Deployment     | Vercel               |

---

## 📂 Project Structure

```bash
.
├── app
│   ├── admin
│   ├── teacher
│   ├── student
│   ├── login
│   │   └── forgot-password
│   ├── change-password
│   ├── sitemap.ts
│   ├── layout.tsx
│   └── page.tsx
├── lib
│   └── supabase.ts
├── public
│   ├── favicon.ico
│   └── logo.jpg
├── .env.local
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### 1️⃣ Install dependencies

```bash
npm install
```

### 2️⃣ Run development server

```bash
npm run dev
```

Open:
👉 http://localhost:3000

---

### 3️⃣ Environment Setup

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
```

---

## 🔐 Authentication Flow

* Users are created via admin
* Profiles stored in `profiles` table
* Logic:

  * `must_change_password = true` → redirect to change password
  * `is_active = false` → block login
* Forgot password:

  * Checks if email exists in profiles
  * Sends reset link via Supabase
  * Redirects to `/reset-password`

---

## 📌 Deployment

This project is deployed using **Vercel**

Steps:

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy 🚀

---

## 👤 Author

**🟢 Jaym Maruji**
Developer of **Qorban Portal**

* GitHub: **@buildwithjaym**
* Email: **[jaymmaruji@gmail.com](mailto:jaymmaruji@gmail.com)**

---

## 💚 Support

If you like this project, consider giving it a ⭐ on GitHub

Your support keeps this project growing 🚀

<div align="center">

🟢 **Built with care by Jaym Maruji**

</div>
