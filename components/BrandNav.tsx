"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BrandNav({ biz, canEdit, isAdmin }: { biz: string; canEdit: boolean; isAdmin: boolean }) {
  const path = usePathname();
  const links = [
    { href: `/b/${biz}`, label: "Register", on: path === `/b/${biz}` || path.startsWith(`/b/${biz}/inv`) },
    ...(canEdit ? [{ href: `/b/${biz}/new`, label: "New invoice", on: path.startsWith(`/b/${biz}/new`) }] : []),
    ...(isAdmin ? [{ href: `/b/${biz}/settings`, label: "Settings", on: path.startsWith(`/b/${biz}/settings`) }] : []),
  ];
  return (
    <nav className="nav" aria-label="Sections">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={l.on ? "page" : undefined}>{l.label}</Link>
      ))}
    </nav>
  );
}
