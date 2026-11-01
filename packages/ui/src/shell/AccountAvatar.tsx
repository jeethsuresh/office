import { useState } from "react";

export type AccountProfile = { name?: string | null; picture?: string | null };
export function accountInitials(name?: string | null) {
  const words = name?.trim().split(/\s+/u).filter(Boolean) ?? [];
  return words.length
    ? [words[0], ...(words.length > 1 ? [words[words.length - 1]] : [])]
        .map((word) => Array.from(word)[0])
        .join("")
        .toLocaleUpperCase()
    : "?";
}
export function AccountAvatar({ account }: { account: AccountProfile }) {
  const [failedPicture, setFailedPicture] = useState<string | null>(null);
  const label = account.name?.trim() || "Signed in";
  return (
    <span
      className="account-avatar"
      role="img"
      aria-label={label}
      title={label}
    >
      {account.picture && failedPicture !== account.picture ? (
        <img
          src={account.picture}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedPicture(account.picture!)}
        />
      ) : (
        accountInitials(account.name)
      )}
    </span>
  );
}
