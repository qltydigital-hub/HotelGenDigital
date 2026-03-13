const fs = require('fs');
const p = 'c:/Users/ozgur/hotel_proje/hotel-admin-dashboard/src/app/page.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/className=\"w-16 h-16 text-([a-z]+)-([0-9]+) mb-6\"/g, 'className=\"w-10 h-10 md:w-16 md:h-16 text-$1-$2 mb-2 md:mb-6\"');

c = c.replace(
  'text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-[3.25rem] font-extrabold tracking-tight mb-4 md:mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-slate-300 pb-2 leading-[1.15]',
  'text-[1.3rem] xs:text-2xl sm:text-3xl md:text-5xl lg:text-5xl xl:text-[3.25rem] font-extrabold tracking-tight mb-2 md:mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-slate-300 pb-1 md:pb-2 leading-[1.15]'
);

c = c.replace(
  'text-lg sm:text-xl md:text-2xl text-blue-400 font-medium mb-4',
  'text-[12px] xs:text-[13px] sm:text-lg md:text-2xl text-blue-400 font-medium mb-2 md:mb-4'
);

c = c.replace(
  'text-base sm:text-lg md:text-xl lg:text-2xl text-slate-300 leading-[1.7] md:leading-[2] font-light w-full max-w-full lg:max-w-6xl mb-8 md:mb-12 px-2 md:px-0',
  'text-[12px] xs:text-[13px] sm:text-sm md:text-xl lg:text-2xl text-slate-300 leading-[1.4] md:leading-[2] font-light w-full max-w-full lg:max-w-6xl mb-4 md:mb-12 px-1 md:px-0'
);

c = c.replace(
  'items-center gap-3 px-8 py-4 rounded-full font-bold text-lg',
  'items-center gap-2 md:gap-3 px-5 py-2.5 md:px-8 md:py-4 rounded-full font-bold text-[13px] md:text-lg'
);

c = c.replace(
  'ArrowRight className=\"w-5 h-5 group-hover:translate-x-1',
  'ArrowRight className=\"w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1'
);

c = c.replace(
  '<div className=\"flex gap-2 mt-16\">',
  '<div className=\"flex gap-2 mt-5 md:mt-16\">'
);

c = c.replace(
  'i === slide ? \'w-8 bg-blue-500\' : \'w-2 bg-slate-700\'',
  'i === slide ? \'w-6 md:w-8 bg-blue-500\' : \'w-1.5 md:w-2 bg-slate-700\''
);

c = c.replace(
  'top-6 right-6 md:top-10 md:right-10 flex flex-col',
  'top-4 right-4 md:top-10 md:right-10 flex flex-col'
);

c = c.replace(
  'px-4 py-2 bg-slate-900/60 hover:bg-slate-800 border border-slate-700/50 rounded-lg text-xs',
  'px-3 py-1.5 md:px-4 md:py-2 bg-slate-900/60 hover:bg-slate-800 border border-slate-700/50 rounded-lg text-[10px] md:text-xs'
);

c = c.replace(
  'px-4 py-2 bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/50 rounded-lg text-xs',
  'px-3 py-1.5 md:px-4 md:py-2 bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/50 rounded-lg text-[10px] md:text-xs'
);

fs.writeFileSync(p, c);
console.log('Mobile optimizations applied');
