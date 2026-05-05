import { ReactNode } from "react";
import { Sidebar } from "./sidebar";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex w-full">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col h-[100dvh] overflow-hidden">{children}</main>
    </div>
  );
}
