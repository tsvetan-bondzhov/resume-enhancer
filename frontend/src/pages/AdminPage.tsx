import UserTable from "@/components/admin/UserTable"

export default function AdminPage() {
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">User Management</h1>
        <p className="text-sm text-muted-foreground">
          View registered accounts and deactivate users.
        </p>
      </header>
      <UserTable />
    </div>
  )
}
