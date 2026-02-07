"use client";

import { usePathname } from "next/navigation";
import Navbar from "./navbar";
import MyOrdersFloat from "./my-orders-float";

export default function CustomerShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  const isAdminLogin = pathname === "/admin/login";

  if (isAdmin && !isAdminLogin) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <div className={isAdminLogin ? "pb-8" : "pb-28 md:pb-32"}>{children}</div>
      {!isAdminLogin && <MyOrdersFloat />}
    </>
  );
}
