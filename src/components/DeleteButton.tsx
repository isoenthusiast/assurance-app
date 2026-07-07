"use client";

export default function DeleteButton({
  action,
}: {
  action: () => Promise<void>;
}) {
  const handleSubmit = async () => {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    try {
      await action();
    } catch {
      // Error handled by caller
    }
  };

  return (
    <button
      type="button"
      onClick={handleSubmit}
      className="text-sm text-red-600 hover:underline"
    >
      Delete
    </button>
  );
}
