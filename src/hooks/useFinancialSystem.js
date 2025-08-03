/**
 * النظام المالي الرئيسي الموحد
 * Hook شامل لجميع العمليات والحسابات المالية
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { 
  calculateFinancialMetrics,
  filterOrdersByPermissions,
  filterExpensesByPermissions,
  calculateDateRange
} from '@/lib/financial-calculations';
import { 
  TIME_PERIODS, 
  DEFAULT_FINANCIAL_VALUES,
  FINANCIAL_ERROR_MESSAGES
} from '@/lib/financial-constants';

export const useFinancialSystem = (timePeriod = TIME_PERIODS.ALL, options = {}) => {
  const { orders, accounting, loading: inventoryLoading } = useInventory();
  const { user } = useAuth();
  const { canViewAllData, hasPermission } = usePermissions();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastCalculationTime, setLastCalculationTime] = useState(null);
  
  // الإعدادات
  const {
    enableCache = true,
    enableDebugLogs = true,
    forceRefresh = false
  } = options;
  
  // فلترة البيانات حسب الصلاحيات
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return filterOrdersByPermissions(orders, canViewAllData, user?.id || user?.user_id);
  }, [orders, canViewAllData, user?.id, user?.user_id]);
  
  const filteredExpenses = useMemo(() => {
    if (!accounting?.expenses) return [];
    return filterExpensesByPermissions(accounting.expenses, canViewAllData, user?.id || user?.user_id);
  }, [accounting?.expenses, canViewAllData, user?.id, user?.user_id]);
  
  // حساب المؤشرات المالية
  const financialMetrics = useMemo(() => {
    if (inventoryLoading) {
      if (enableDebugLogs) {
        console.log('⏳ النظام المالي: في انتظار تحميل البيانات...');
      }
      return { ...DEFAULT_FINANCIAL_VALUES, loading: true };
    }
    
    if (!filteredOrders.length && !filteredExpenses.length) {
      if (enableDebugLogs) {
        console.log('⚠️ النظام المالي: لا توجد بيانات للحساب');
      }
      return { 
        ...DEFAULT_FINANCIAL_VALUES, 
        error: FINANCIAL_ERROR_MESSAGES.NO_DATA,
        loading: false 
      };
    }
    
    try {
      if (enableDebugLogs) {
        console.log('🔧 النظام المالي: بدء الحسابات...', {
          ordersCount: filteredOrders.length,
          expensesCount: filteredExpenses.length,
          timePeriod,
          userCanViewAll: canViewAllData
        });
      }
      
      const metrics = calculateFinancialMetrics(filteredOrders, filteredExpenses, timePeriod);
      
      if (enableDebugLogs) {
        console.log('✅ النظام المالي: اكتملت الحسابات بنجاح', metrics);
      }
      
      setLastCalculationTime(new Date());
      setError(null);
      
      return { ...metrics, loading: false };
      
    } catch (err) {
      console.error('❌ النظام المالي: خطأ في الحسابات:', err);
      setError(err.message);
      
      return { 
        ...DEFAULT_FINANCIAL_VALUES, 
        error: err.message,
        loading: false 
      };
    }
  }, [filteredOrders, filteredExpenses, timePeriod, inventoryLoading, canViewAllData, enableDebugLogs]);
  
  // تحديث حالة التحميل
  useEffect(() => {
    setLoading(inventoryLoading || financialMetrics.loading);
  }, [inventoryLoading, financialMetrics.loading]);
  
  // دالة إعادة التحميل
  const refreshData = useCallback(() => {
    if (enableDebugLogs) {
      console.log('🔄 النظام المالي: إعادة تحميل البيانات...');
    }
    setError(null);
    setLastCalculationTime(new Date());
  }, [enableDebugLogs]);
  
  // دالة تغيير الفترة الزمنية
  const changePeriod = useCallback((newPeriod) => {
    if (enableDebugLogs) {
      console.log('📅 النظام المالي: تغيير الفترة الزمنية:', { from: timePeriod, to: newPeriod });
    }
  }, [timePeriod, enableDebugLogs]);
  
  // معلومات إضافية
  const systemInfo = useMemo(() => ({
    lastCalculationTime,
    dateRange: calculateDateRange(timePeriod),
    dataSource: {
      ordersCount: filteredOrders.length,
      expensesCount: filteredExpenses.length,
      hasFullAccess: canViewAllData
    },
    permissions: {
      canViewAllData,
      canManageFinances: hasPermission('manage_finances'),
      canViewReports: hasPermission('view_reports')
    }
  }), [lastCalculationTime, timePeriod, filteredOrders.length, filteredExpenses.length, canViewAllData, hasPermission]);
  
  return {
    // البيانات المالية الرئيسية
    ...financialMetrics,
    
    // حالة النظام
    loading,
    error,
    
    // البيانات المفلترة
    filteredOrders,
    filteredExpenses,
    
    // معلومات النظام
    systemInfo,
    
    // دوال التحكم
    refreshData,
    changePeriod,
    
    // دوال مساعدة للمكونات
    formatCurrency: (amount) => {
      return new Intl.NumberFormat('ar-IQ', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount || 0) + ' د.ع';
    },
    
    formatPercentage: (percentage) => {
      return `${(percentage || 0).toFixed(1)}%`;
    },
    
    // التحقق من صحة البيانات
    isDataValid: !error && !loading && (filteredOrders.length > 0 || filteredExpenses.length > 0),
    
    // إحصائيات سريعة
    quickStats: {
      hasRevenue: financialMetrics.totalRevenue > 0,
      hasProfits: financialMetrics.netProfit > 0,
      hasExpenses: financialMetrics.generalExpenses > 0 || financialMetrics.employeeDuesPaid > 0,
      profitabilityStatus: financialMetrics.netProfit > 0 ? 'profitable' : 
                          financialMetrics.netProfit < 0 ? 'loss' : 'breakeven'
    }
  };
};

export default useFinancialSystem;