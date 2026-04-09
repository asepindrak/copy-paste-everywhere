# Copy Paste Everywhere

<p align="center">
  <img src="public/logo.png" alt="Copy Paste Everywhere Logo" width="120" />
</p>

<p align="center">
  <img src="copy-paste-everywhere.png" alt="Copy Paste Everywhere Preview" width="100%" style="max-width: 920px;" />
</p>

**Copy Paste Everywhere** is a lightweight, private, and real-time clipboard synchronization tool. It allows you to sync text and images across all your devices instantly using WebSockets.

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![Socket.io](https://img.shields.io/badge/Socket.io-4.8-blue?style=flat-square&logo=socket.io)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=flat-square&logo=tailwindcss)

## 🚀 Features

- **Real-time Sync**: Instant synchronization across all connected devices using Socket.io.
- **Private & Secure**: Built-in authentication with NextAuth.js. Each user has their own private clipboard history.
- **Live Editor**: A simple, intuitive interface to write or paste text.
- **Image Support**: Paste images directly or drag & drop images into the dashboard for instant clipboard syncing.
- **Drag & Drop**: Easily drag files or images into the editor area to add them to your clipboard history.
- **History Tracking**: Keep track of your previous clipboard items.
- **One-Click Actions**: "Copy All" and "Paste & Replace" buttons with visual feedback animations.
- **Modern UI**: Clean, responsive dark-themed dashboard built with Tailwind CSS.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Real-time**: [Socket.io](https://socket.io/)
- **Database**: PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Authentication**: [NextAuth.js](https://next-auth.js.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Runtime**: [Node.js](https://nodejs.org/) with `ts-node` for custom server handling

## 🏁 Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL database

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/asepindrak/copy-paste-everywhere.git
   cd copy-paste-everywhere
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory (refer to `.env.example`):

   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/database"
   NEXTAUTH_SECRET="your-secret-key"
   NEXTAUTH_URL="http://localhost:3000"
   NEXT_PUBLIC_SOCKET_URL="http://localhost:3000"
   ```

4. **Database Migration**

   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📦 Scripts

- `npm run dev`: Starts the custom Next.js server with Socket.io support.
- `npm run build`: Builds the application for production.
- `npm run start`: Starts the production server.
- `npm run lint`: Runs ESLint for code quality checks.

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests to help improve this project.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
