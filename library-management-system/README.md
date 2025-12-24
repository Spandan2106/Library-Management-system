# OldTown Library Management System

A comprehensive web-based application built with Node.js, Express, and MongoDB to manage library operations. This system handles book inventory, user management, borrowing/returning workflows, fine calculations, and history tracking with PDF receipt generation.

## 🚀 Features

### 📚 Book Management
- **Inventory Control**: Add, delete, and view books.
- **Search & Filter**: Search books by name or author; filter by availability.
- **Issue & Return**: Streamlined process for issuing and returning books.
- **Fine Calculation**: Automatic fine calculation ($1/day) for books returned after 7 days.

### 👥 User Roles & Security
- **Librarian (Admin)**:
  - Full access to the Admin Dashboard.
  - Manage users (Soft Delete to preserve history).
  - Toggle Maintenance Mode.
  - Reset System History.
- **Assistant**:
  - Restricted access to issue/return books.
  - Borrowing limits enforced (Max 20 books total, Max 5 copies of same book).
- **Borrower (User)**:
  - View personal profile and borrowing history.
  - Search the library catalog.
- **Security**:
  - Password hashing using `bcrypt`.
  - Account lockout after 10 failed login attempts.
  - Secure session handling.

### 📝 Reporting & History
- **History Tracking**: Detailed logs of issued and returned books for both staff and borrowers.
- **PDF Receipts**: Generate downloadable PDF receipts for transactions.
- **Email Integration**: Send transaction history and receipts directly to borrowers via email (using Nodemailer).
- **CSV Export**: Export user history to CSV format.

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Mongoose)
- **Frontend**: EJS (Embedded JavaScript templates), CSS
- **Utilities**:
  - `pdfkit` (PDF Generation)
  - `nodemailer` (Email Services)
  - `bcrypt` (Security)
  - `dotenv` (Environment Variables)

## ⚙️ Installation & Setup

### Prerequisites
- Node.js installed.
- MongoDB installed and running locally on port `27017`.

### Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/library-management-system.git
   cd library-management-system
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory and add your email credentials (required for emailing receipts):
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-16-char-google-app-password
   ```
   *Note: For Gmail, use an App Password, not your login password.*

4. **Start the Server**
   ```bash
   node app.js
   ```

5. **Access the Application**
   Open your browser and navigate to:
   `http://localhost:3000`

## 📖 Usage Guide

### Default Credentials
The system enforces specific username patterns for staff roles:

- **Librarian (Admin)**:
  - Username: `lib0.0`
  - *Note: This is the only allowed username for the Librarian role.*

- **Assistant**:
  - Username: `as1` through `as10`
  - *Note: Assistants are limited to these specific usernames.*

### Admin Dashboard
Login as `lib0.0` to access the Admin Panel where you can:
- View top borrowers.
- Delete users (Soft delete).
- Toggle "Maintenance Mode" to lock out non-admin users.

## 📄 License

All Rights Reserved by Old-Town Library.