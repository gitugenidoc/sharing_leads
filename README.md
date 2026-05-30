# Lead Management Dashboard

A complete web application for managing leads with admin and agent roles. Admin can import leads from Excel, assign them to agents, and agents can manage their assigned leads.

## Features

- **Authentication**: JWT-based login/registration system
- **Admin Dashboard**:
  - View all leads
  - Create/Edit/Delete leads
  - Import leads from Excel (bulk)
  - Manage users (create, edit, delete)
  - Assign leads to agents
  - Search and filter leads
- **Agent Dashboard**:
  - View assigned leads (20-30 per agent)
  - Update lead status and notes
  - Search and filter own leads
- **RBAC**: Role-based access control (Admin vs Agent)
- **Database**: PostgreSQL with migrations
- **Frontend**: Vanilla HTML/CSS/JavaScript (no frameworks)

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (jsonwebtoken)
- **File Upload**: express-fileupload
- **Excel Parsing**: xlsx

## Installation

### Prerequisites

- Node.js (v14+)
- PostgreSQL (v12+)
- npm or yarn

### Setup Steps

1. **Clone/Download the project**

   ```bash
   cd sharing_leads
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your PostgreSQL credentials
   ```

4. **Create PostgreSQL database**

   ```bash
   psql -U postgres
   CREATE DATABASE leads_db;
   \q
   ```

5. **Run database migrations**

   ```bash
   npm run db:migrate
   ```

6. **Start the server**

   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

7. **Access the application**
   - Frontend: `http://localhost:3000` (or serve from backend public folder)
   - Backend API: `http://localhost:5000/api`

## Usage

### Admin Workflow

1. **Login** - Navigate to `/index.html` and login with admin credentials
2. **Create Users** - Go to "Users" tab and create agent accounts
3. **Import Leads** - Go to "Import" tab, upload Excel file with leads
4. **Assign Leads** - In "Leads" tab, assign leads to specific agents using the dropdown
5. **Manage Leads** - Edit or delete leads as needed

### Agent Workflow

1. **Login** - Use agent credentials on `/index.html`
2. **View Leads** - See all assigned leads on the dashboard
3. **Update Status** - Click on a lead and update its status (New → Contacted → Interested → Qualified → Closed)
4. **Add Notes** - Add internal notes to track communication
5. **Search** - Find specific leads using name, email, or phone

## Excel Import Format

The Excel file should have the following columns (headers):

- **name** (required) - Lead name
- **email** - Email address
- **phone** - Phone number
- **status** - Lead status (default: NEW)
- **source** - Lead source (default: IMPORT)
- **amount** - Deal amount
- **notes** - Additional notes

Example:

```
| name        | email              | phone         | status   | source | amount | notes      |
|-----|-----------------|-----------|----------|--------|--------|---------|
| John Doe    | john@example.com   | 555-1234  | NEW     | Web    | 5000   | Interested|
| Jane Smith  | jane@example.com   | 555-5678  | NEW     | Phone  | 3000   |           |
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires token)

### Users (Admin only)

- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Leads

- `GET /api/leads` - Get all leads (admin only) with pagination
- `GET /api/leads/me` - Get current user's assigned leads
- `GET /api/leads/:id` - Get lead by ID
- `POST /api/leads` - Create lead (admin only)
- `PUT /api/leads/:id` - Update lead (admin or assignee)
- `DELETE /api/leads/:id` - Delete lead (admin only)
- `PUT /api/leads/:id/assign` - Assign lead to user (admin only)
- `POST /api/leads/import` - Bulk import leads from Excel (admin only)
- `GET /api/leads/search?q=query` - Search leads

## Database Schema

### users table

```sql
- id (SERIAL PRIMARY KEY)
- email (VARCHAR UNIQUE)
- password (VARCHAR)
- name (VARCHAR)
- role (VARCHAR) - 'ADMIN' or 'AGENT'
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### leads table

```sql
- id (SERIAL PRIMARY KEY)
- name (VARCHAR)
- email (VARCHAR)
- phone (VARCHAR)
- status (VARCHAR) - 'NEW', 'CONTACTED', 'INTERESTED', 'QUALIFIED', 'CLOSED'
- source (VARCHAR)
- amount (DECIMAL)
- notes (TEXT)
- assigned_to (INTEGER, FOREIGN KEY -> users.id)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### lead_assignments table

```sql
- id (SERIAL PRIMARY KEY)
- lead_id (INTEGER, FOREIGN KEY -> leads.id)
- user_id (INTEGER, FOREIGN KEY -> users.id)
- assigned_at (TIMESTAMP)
- unassigned_at (TIMESTAMP)
```

## Project Structure

```
sharing_leads/
├── backend/
│   ├── config/
│   │   └── db.js                 # PostgreSQL connection
│   ├── models/
│   │   ├── User.js               # User model
│   │   └── Lead.js               # Lead model
│   ├── middleware/
│   │   └── auth.js               # Authentication & authorization
│   ├── routes/
│   │   ├── auth.js               # Auth endpoints
│   │   ├── users.js              # User endpoints
│   │   └── leads.js              # Lead endpoints
│   ├── db/
│   │   └── migrate.js            # Database migrations
│   └── server.js                 # Express app entry point
├── frontend/
│   └── public/
│       ├── index.html            # Login/Register page
│       ├── admin.html            # Admin dashboard
│       ├── agent.html            # Agent dashboard
│       ├── css/
│       │   └── style.css         # Styles
│       └── js/
│           └── api.js            # API client functions
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Troubleshooting

### Port already in use

- Change PORT in `.env` file
- Or kill process using port: `lsof -i :5000`

### Database connection error

- Check PostgreSQL is running
- Verify DB credentials in `.env`
- Ensure database `leads_db` exists

### Excel import fails

- Verify Excel format matches specification
- Check file size (recommend < 10MB)
- Ensure first row has headers

### Can't login

- Verify user exists in database
- Check password is correct
- Try registering a new user

## Performance Notes

- Initial setup: ~5000 leads = 500MB disk
- Search: ~100ms for full table scan
- Pagination: 50 leads per page recommended
- Excel import: ~1000 leads = ~5 seconds

## Future Enhancements

- [ ] Email notifications on lead assignment
- [ ] Lead activity audit log
- [ ] Advanced filtering and segmentation
- [ ] Dashboard charts and analytics
- [ ] Lead conversion tracking
- [ ] Integration with CRM systems
- [ ] Mobile app

## License

MIT
