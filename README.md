# <div align="center">🟢🟡 Qorban Portal</div>

<div align="center">

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Geist&weight=700&size=26&pause=1000&color=166534&center=true&vCenter=true&width=700&lines=Online+Grade+Management+System;Built+for+Students%2C+Teachers%2C+and+Administrators;Secure%2C+Modern%2C+and+Scalable)](https://git.io/typing-svg)

<br />

<img src="./public/logo.jpg" alt="Qorban Portal Logo" width="120" />

<br /><br />

![Next.js](https://img.shields.io/badge/Next.js-15-166534?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-14532D?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20DB-166534?style=for-the-badge&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-Styled-15803D?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-854D0E?style=for-the-badge&logo=vercel&logoColor=white)

<br />

![Status](https://img.shields.io/badge/Status-Active-success?style=flat-square)
![Maintenance](https://img.shields.io/badge/Maintained-Yes-22c55e?style=flat-square)
![License](https://img.shields.io/badge/Use-Educational%20%26%20Institutional-ca8a04?style=flat-square)

</div>

---

## 📚 Overview

**Qorban Portal** is a modern **Online Grade Management System** built to streamline academic workflows for **students, teachers, and administrators**.

It provides a secure, role-based platform for:

- viewing and managing grades
- handling user accounts and profiles
- enforcing password-change flows
- maintaining academic data in a clean, responsive interface

This project is built with **Next.js**, **Supabase**, **TypeScript**, and **Tailwind CSS**.

---

## ✨ Key Features

### 🔐 Authentication & Security
- Secure login using **Supabase Auth**
- Role-based authentication
- Password visibility toggles
- Forced password change for newly created accounts
- Forgot password and account recovery flow
- Active/inactive account enforcement

### 👥 Role-Based Access
- **Admin Dashboard**
- **Teacher Dashboard**
- **Student Dashboard**

Each role is redirected automatically after login.

### 🧾 User Management
- Centralized profile storage in Supabase
- `must_change_password` support
- `is_active` account status support
- Profile-linked access control

### 🎨 User Experience
- Clean green-and-gold Qorban Portal branding
- Responsive layouts
- Modern form styling
- Smooth transitions and polished interfaces

### 🌐 SEO & Search Visibility
- Google Search Console verified
- Sitemap support
- Metadata optimization
- Public-facing homepage for indexing

### 📈 Analytics
- Vercel Analytics integration ready

---

## 🛠 Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Backend | Supabase |
| Authentication | Supabase Auth |
| Database | PostgreSQL via Supabase |
| Deployment | Vercel |

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
---

## 👨‍💻 Author

Jaym Maruji
Developer of Qorban Portal

GitHub: @buildwithjaym
Email: jaymmaruji@gmail.com

💚 Support

If you like this project, consider giving it a star on GitHub.

<div align="center">
⭐ Built with care by Jaym Maruji
</div> ```