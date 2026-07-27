import { NavLink } from 'react-router-dom';

import { BillisanLogo } from '@/components/brand/BillisanLogo';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/shared/constants/navigation';

export function AppSidebar() {
    return (
        <aside className="hidden w-[252px] shrink-0 flex-col bg-brand-navy md:flex">
            <div className="px-6 pt-10">
                <BillisanLogo className="h-[30px] w-[67px]" />
            </div>

            <nav className="mt-[59px] flex flex-col gap-3 px-3">
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) =>
                            cn(
                                'flex h-[38px] items-center gap-[18px] rounded-[9px] px-[22px] text-[13.5px] transition-colors',
                                isActive
                                    ? 'bg-brand-blue font-bold text-white'
                                    : 'font-medium text-brand-navy-label hover:bg-brand-navy-hover',
                            )
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon
                                    className={isActive ? 'text-white' : 'text-brand-navy-icon'}
                                />
                                <span className="truncate">{item.label}</span>
                                {Boolean(item.badge) && (
                                    <span
                                        className={cn(
                                            'ml-auto flex h-[19px] min-w-[19px] items-center justify-center rounded-[5px] px-1 text-[11px] font-bold text-white',
                                            isActive ? 'bg-white/25' : 'bg-brand-navy-badge',
                                        )}
                                    >
                                        {item.badge}
                                    </span>
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
}
