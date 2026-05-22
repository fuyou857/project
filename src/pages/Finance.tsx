import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import InvoiceEntry from './finance/InvoiceEntry';
import PaymentRegistration from './finance/PaymentRegistration';
import UnpaidInvoices from './finance/UnpaidInvoices';
import UninvoicedPayments from './finance/UninvoicedPayments';
import IncomeInvoiceIssue from './finance/IncomeInvoiceIssue';
import IncomeInvoiceList from './finance/IncomeInvoiceList';

export default function Finance() {
  const location = useLocation();

  const renderContent = () => {
    const path = location.pathname;
    if (path.includes('/cost-invoice')) return <InvoiceEntry />;
    if (path.includes('/invoice-list')) return <IncomeInvoiceList />;
    if (path.includes('/payment')) return <PaymentRegistration />;
    if (path.includes('/unpaid')) return <UnpaidInvoices />;
    if (path.includes('/uninvoiced')) return <UninvoicedPayments />;
    return <IncomeInvoiceIssue />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full"
    >
      {renderContent()}
    </motion.div>
  );
}
