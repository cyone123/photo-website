import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "管理后台",
    template: "%s · 管理后台",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AdminRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
