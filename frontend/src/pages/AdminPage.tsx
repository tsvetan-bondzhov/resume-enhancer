import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import UserTable from "@/components/admin/UserTable"
import TemplateManager from "@/components/admin/TemplateManager"

export default function AdminPage() {
  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Administration</h1>
        <p className="text-sm text-muted-foreground">
          Manage user accounts and the prebuilt template library.
        </p>
      </header>
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <UserTable />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <TemplateManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}
