import React from "react";

export default function Card({
  children,
  className = "",
  header = null,
  footer = null,
  hoverable = false,
  ...props
}) {
  return (
    <section
      className={`bg-white/95 rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden backdrop-blur-sm transition-all duration-200 ${
        hoverable ? "hover:shadow-md hover:border-slate-300" : ""
      } ${className}`}
      {...props}
    >
      {header && (
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          {header}
        </div>
      )}
      <div className="p-6">{children}</div>
      {footer && (
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100">
          {footer}
        </div>
      )}
    </section>
  );
}

