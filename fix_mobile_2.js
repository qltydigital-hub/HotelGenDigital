const fs = require('fs');
const p = 'c:/Users/ozgur/hotel_proje/hotel-admin-dashboard/src/app/page.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  'absolute top-4 right-4 md:top-10 md:right-10 flex flex-col sm:flex-row gap-2 sm:gap-3 z-50',
  'absolute top-4 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:top-10 md:right-10 flex flex-row gap-2 sm:gap-3 z-50 w-max'
);

c = c.replace(
  'text-[1.3rem] xs:text-2xl sm:text-3xl md:text-5xl lg:text-5xl xl:text-[3.25rem] font-extrabold tracking-tight mb-2 md:mb-6',
  'text-[1.5rem] xs:text-[1.75rem] sm:text-3xl md:text-5xl lg:text-5xl xl:text-[3.25rem] font-extrabold tracking-tight mb-3 md:mb-6'
);

c = c.replace(
  'text-[12px] xs:text-[13px] sm:text-lg md:text-2xl text-blue-400 font-medium mb-2 md:mb-4',
  'text-[14px] xs:text-[15px] sm:text-lg md:text-2xl text-blue-400 font-medium mb-3 md:mb-4'
);

c = c.replace(
  'text-[12px] xs:text-[13px] sm:text-sm md:text-xl lg:text-2xl text-slate-300 leading-[1.4] md:leading-[2] font-light w-full max-w-full lg:max-w-6xl mb-4 md:mb-12 px-1 md:px-0',
  'text-[14px] xs:text-[16px] sm:text-[17px] md:text-xl lg:text-2xl text-slate-300 leading-[1.5] md:leading-[2] font-light w-full max-w-full lg:max-w-6xl mb-6 md:mb-12 px-2 md:px-0'
);

c = c.replace(
  'gap-2 md:gap-3 px-5 py-2.5 md:px-8 md:py-4 rounded-full font-bold text-[13px]',
  'gap-2 md:gap-3 px-6 py-3 md:px-8 md:py-4 rounded-full font-bold text-[15px]'
);

// update icons
c = c.replace(
    /w-10 h-10 md:w-16 md:h-16/g,
    'w-12 h-12 md:w-16 md:h-16'
);

fs.writeFileSync(p, c);
console.log('Mobile layout tweaks applied');
