import { ShieldCheckIcon, CheckBadgeIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { ReactNode } from 'react';

interface AnimatedBackgroundProps {
  children: ReactNode;
}

const AnimatedBackground = ({ children }: AnimatedBackgroundProps) => {
  return (
    <div className="relative w-full overflow-hidden min-h-screen">
      {/* Fondo abstracto animado */}
      <div className="fixed inset-0 -z-10 w-screen">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-base-100 to-primary/5">
          {/* Círculos decorativos */}
          <div className="absolute -left-20 top-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -right-20 bottom-20 w-[30rem] h-[30rem] bg-primary/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          
          {/* Grid de puntos */}
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle,_#4338ca_1px,_transparent_1px)] [background-size:24px_24px]"></div>
        </div>
        
        {/* Iconos flotantes */}
        <div className="absolute -left-10 top-1/4 transform -translate-y-1/2 animate-float-slow">
          <ShieldCheckIcon className="w-32 h-32 text-primary/20" />
        </div>
        <div className="absolute -right-10 top-1/3 transform -translate-y-1/2 animate-float-slow delay-1000">
          <CheckBadgeIcon className="w-28 h-28 text-primary/15" />
        </div>
        <div className="absolute bottom-1/4 left-1/3 transform -translate-x-1/2 translate-y-1/2 animate-float-slow delay-2000">
          <ArrowPathIcon className="w-24 h-24 text-primary/10" />
        </div>
      </div>

      {/* Contenido */}
      {children}
    </div>
  );
};

export default AnimatedBackground; 