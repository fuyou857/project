import { motion } from 'framer-motion';
import CostInvoiceEntry_v2 from './costInvoice_v2/CostInvoiceEntry_v2';

export default function InvoiceEntry() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <CostInvoiceEntry_v2 />
    </motion.div>
  );
}