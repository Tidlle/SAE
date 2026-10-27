import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

// --- LOGO ---
export const Logo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <img
    src={`${import.meta.env.BASE_URL}logo-sae.png`}
    alt="SAE - Sistema de Apoio Educacional"
    className={`object-contain max-w-none shrink-0 ${className}`}
  />
);

// --- BUTTONS ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-semibold transition-all duration-200 rounded-full focus:outline-none focus:ring-2 focus:ring-sae-accent/50 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-sae-accent text-white hover:bg-sae-accentHover",
    secondary: "bg-sae-card text-sae-text border border-sae-border hover:bg-sae-accentSoft",
    outline: "border border-sae-accent text-sae-accentText hover:bg-sae-accentSoft",
    ghost: "text-sae-muted hover:text-sae-text hover:bg-sae-border/50",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-6 py-3.5 text-lg",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};

// --- CARDS ---
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', hoverEffect = false }) => {
  return (
    <div className={`bg-sae-card border border-sae-border rounded-xl overflow-hidden shadow-lg shadow-black/5 ${hoverEffect ? 'hover:border-sae-accent/50 transition-colors duration-300' : ''} ${className}`}>
      {children}
    </div>
  );
};

// --- BADGES ---
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'primary' }) => {
  const variants = {
    primary: "bg-sae-accentSoft text-sae-accentText border-sae-accent/30",
    secondary: "bg-sae-border text-sae-muted",
    success: "bg-sae-success/15 text-sae-success border-sae-success/30",
    warning: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  };

  return (
    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full border ${variants[variant]}`}>
      {children}
    </span>
  );
};

// --- BREADCRUMB ---
interface BreadcrumbProps {
  items: { label: string; path?: string }[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  return (
    <nav className="flex items-center text-sm text-sae-muted mb-6">
      <Link to="/" className="hover:text-sae-accentText transition-colors">Início</Link>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <ChevronRight size={14} className="mx-2" />
          {item.path ? (
            <Link to={item.path} className="hover:text-sae-accentText transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-sae-text font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

// --- SECTION TITLE ---
export const SectionTitle: React.FC<{ title: string; subtitle?: string; align?: 'left' | 'center' }> = ({ 
  title, 
  subtitle,
  align = 'left' 
}) => {
  return (
    <div className={`mb-8 ${align === 'center' ? 'text-center' : ''}`}>
      <h2 className="text-3xl font-heading font-bold text-sae-text mb-2">{title}</h2>
      {subtitle && <p className="text-sae-muted max-w-2xl mx-auto">{subtitle}</p>}
      <div className={`h-1 w-20 bg-sae-accent mt-4 rounded-full ${align === 'center' ? 'mx-auto' : ''}`}></div>
    </div>
  );
};