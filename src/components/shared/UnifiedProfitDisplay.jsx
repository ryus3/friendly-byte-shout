import React from 'react';
import StatCard from '@/components/dashboard/StatCard';
import { useSettledDues } from '@/hooks/useSettledDues';
import { 
  User, 
  Hourglass, 
  CheckCircle, 
  Users, 
  TrendingDown, 
  PackageCheck,
  Wallet,
  TrendingUp
} from 'lucide-react';

/**
 * عنصر موحد لعرض بيانات الأرباح
 * يمكن استخدامه في لوحة التحكم والمركز المالي بتصاميم مختلفة
 */
const UnifiedProfitDisplay = ({
  profitData,
  displayMode = 'dashboard', // 'dashboard' | 'financial-center' | 'profits-summary'
  canViewAll = true,
  onFilterChange = () => {},
  onExpensesClick = () => {},
  onSettledDuesClick = () => {},
  className = ''
}) => {
  // استخدام هوك المستحقات الموحد
  const { settledDues } = useSettledDues();

  // تحديد التصميم بناءً على المكان
  const getLayoutClasses = () => {
    if (displayMode === 'financial-center') {
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
    } else if (displayMode === 'profits-summary') {
      return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6';
    }
    return canViewAll 
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6';
  };

  // بناء البطاقات للعرض
  const buildCards = () => {
    const cards = [];

    console.log('🔧 بناء كروت العرض:', { profitData, canViewAll, displayMode });

    if (canViewAll) {
      // للمدير: عرض بيانات النظام الكاملة
      if (displayMode === 'financial-center') {
        // في المركز المالي: التركيز على الجانب المالي
        cards.push(
          {
            key: 'net-system-profit',
            title: 'صافي ربح النظام',
            value: profitData.netProfit || 0,
            icon: Wallet,
            colors: ['emerald-600', 'teal-600'],
            format: 'currency',
            description: 'بعد خصم المصاريف العامة'
          },
          {
            key: 'total-manager-profits',
            title: 'أرباح المؤسسة',
            value: profitData.managerProfitFromEmployees || 0,
            icon: TrendingUp,
            colors: ['blue-600', 'indigo-600'],
            format: 'currency',
            description: 'قبل خصم المصاريف'
          },
          {
            key: 'total-employee-profits',
            title: 'أرباح الموظفين',
            value: (profitData.detailedProfits || []).reduce((sum, p) => sum + p.profit, 0),
            icon: Users,
            colors: ['purple-600', 'violet-600'],
            format: 'currency',
            onClick: () => onFilterChange('employeeId', 'employees')
          }
        );
      } else {
        // في لوحة التحكم: عرض شامل
        cards.push(
          {
            key: 'net-profit',
            title: 'صافي الربح',
            value: profitData.netProfit || 0,
            icon: User,
            colors: ['green-500', 'emerald-500'],
            format: 'currency'
          },
          {
            key: 'manager-profit-from-employees',
            title: 'أرباح من الموظفين',
            value: profitData.managerProfitFromEmployees || 0,
            icon: Users,
            colors: ['indigo-500', 'violet-500'],
            format: 'currency',
            onClick: () => onFilterChange('employeeId', 'employees')
          },
          {
            key: 'general-expenses',
            title: 'المصاريف العامة',
            value: profitData.generalExpenses || 0,
            icon: TrendingDown,
            colors: ['red-500', 'orange-500'],
            format: 'currency',
            onClick: onExpensesClick
          },
          {
            key: 'paid-dues',
            title: 'المستحقات المدفوعة',
            value: settledDues.totalAmount || 0, // استخدام البيانات الموحدة
            icon: PackageCheck,
            colors: ['purple-500', 'violet-500'],
            format: 'currency',
            onClick: onSettledDuesClick
          }
        );
      }
    } else {
      // للموظف: البيانات الشخصية فقط
      cards.push(
        {
          key: 'my-total-profit',
          title: 'إجمالي أرباحي',
          value: profitData.totalPersonalProfit || 0,
          icon: User,
          colors: ['green-500', 'emerald-500'],
          format: 'currency'
        }
      );
    }

    // إضافة بطاقة الأرباح المعلقة فقط (حذف الأرباح المستلمة)
    cards.push({
      key: 'pending-profit',
      title: 'الأرباح المعلقة',
      value: canViewAll 
        ? (profitData.detailedProfits || [])
            .filter(p => (p.profitStatus || 'pending') === 'pending')
            .reduce((sum, p) => sum + p.profit, 0)
        : profitData.personalPendingProfit || 0,
      icon: Hourglass,
      colors: ['yellow-500', 'amber-500'],
      format: 'currency',
      onClick: () => onFilterChange('profitStatus', 'pending')
    });

    console.log('✅ تم بناء الكروت:', cards.map(c => ({ key: c.key, value: c.value })));
    return cards;
  };

  const cards = buildCards();

  return (
    <div className={`${getLayoutClasses()} ${className}`}>
      {cards.map(({ key, ...cardProps }) => (
        <StatCard 
          key={key} 
          {...cardProps}
          // إضافة ستايل خاص للمركز المالي
          className={displayMode === 'financial-center' ? 'financial-card' : ''}
        />
      ))}
    </div>
  );
};

export default UnifiedProfitDisplay;