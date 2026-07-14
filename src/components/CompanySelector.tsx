"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CompanyOption = {
  id: string;
  companyID: string;
};

export default function CompanySelector({
  companies,
  selectedId,
}: {
  companies: CompanyOption[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(selectedId || "");

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setCurrent(value);
    // Set cookie and refresh to apply company filter
    document.cookie = `selectedCompanyId=${value}; path=/; max-age=86400; SameSite=Lax`;
    router.refresh();
  };

  if (companies.length === 0) return null;

  return (
    <select
      value={current}
      onChange={handleChange}
      className="text-xs border border-slate-300 rounded px-2 py-1 bg-white text-slate-700 font-medium"
    >
      {companies.map((c) => (
        <option key={c.id} value={c.id}>
          {c.companyID}
        </option>
      ))}
    </select>
  );
}
