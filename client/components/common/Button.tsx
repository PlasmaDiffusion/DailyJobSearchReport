import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
};

export function Button({ children, variant = 'secondary', className = '', ...props }: ButtonProps) {
  return (
    <button className={`app-button app-button--${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
