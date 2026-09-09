export default function Badge({
  children,
  variant = "neutral",
  size = "sm",
  dot = false,
  className = "",
}) {
  const sizeClasses = {
    xs: "text-[10px] px-2 py-0.5 font-medium",
    sm: "text-xs px-2.5 py-1 font-semibold",
    md: "text-sm px-3 py-1.5 font-semibold",
  };

  const variantClasses = {
    neutral: "bg-slate-100 text-slate-700 border border-slate-200",
    primary: "bg-violet-100 text-violet-800 border border-violet-200",
    success: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    danger: "bg-rose-100 text-rose-800 border border-rose-200",
    warning: "bg-amber-100 text-amber-800 border border-amber-200",
    purple: "bg-purple-100 text-purple-800 border border-purple-200",
  };

  const dotClasses = {
    neutral: "bg-slate-500",
    primary: "bg-violet-500",
    success: "bg-emerald-500",
    danger: "bg-rose-500",
    warning: "bg-amber-500",
    purple: "bg-purple-500",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${
        sizeClasses[size] || sizeClasses.sm
      } ${variantClasses[variant] || variantClasses.neutral} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            dotClasses[variant] || dotClasses.neutral
          }`}
        />
      )}
      {children}
    </span>
  );
}
