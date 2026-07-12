export const mockUsers = [
  { id: '1', name: 'Rajesh Kumar', role: 'dealer', email: 'rajesh@autoworld.com', phone: '+91 98765 43210', company: 'Auto World Motors', plan: 'Enterprise', registrationDate: '2024-01-15', status: 'active', address: '42 MG Road', city: 'Mumbai', state: 'Maharashtra', gst: '27AABCU9603R1ZM', license: 'DL-2024-001', subscriptionStart: '2024-01-15', subscriptionEnd: '2025-01-15', subscriptionStatus: 'active' },
  { id: '2', name: 'Priya Sharma', role: 'agent', email: 'priya@rtoassist.com', phone: '+91 87654 32109', company: 'RTO Assist Services', plan: 'Professional', registrationDate: '2024-02-20', status: 'active', address: '15 Park Street', city: 'Kolkata', state: 'West Bengal', gst: '19AABCP1234R1Z5', license: 'AG-2024-002', subscriptionStart: '2024-02-20', subscriptionEnd: '2025-02-20', subscriptionStatus: 'active' },
  { id: '3', name: 'Amit Patel', role: 'dealer', email: 'amit@speedmotors.com', phone: '+91 76543 21098', company: 'Speed Motors Pvt Ltd', plan: 'Basic', registrationDate: '2024-03-10', status: 'pending', address: '88 Ring Road', city: 'Ahmedabad', state: 'Gujarat', gst: '24AABCA5678R1Z3', license: 'DL-2024-003', subscriptionStart: null, subscriptionEnd: null, subscriptionStatus: 'expired' },
  { id: '4', name: 'Sneha Reddy', role: 'agent', email: 'sneha@docverify.in', phone: '+91 65432 10987', company: 'DocVerify Solutions', plan: 'Professional', registrationDate: '2024-04-05', status: 'active', address: '23 Hitech City', city: 'Hyderabad', state: 'Telangana', gst: '36AABCS9012R1Z7', license: 'AG-2024-004', subscriptionStart: '2024-04-05', subscriptionEnd: '2025-04-05', subscriptionStatus: 'expiring' },
  { id: '5', name: 'Vikram Singh', role: 'dealer', email: 'vikram@royalmotors.com', phone: '+91 54321 09876', company: 'Royal Motors', plan: 'Enterprise', registrationDate: '2024-05-18', status: 'suspended', address: '7 Civil Lines', city: 'Jaipur', state: 'Rajasthan', gst: '08AABCV3456R1Z9', license: 'DL-2024-005', subscriptionStart: '2024-05-18', subscriptionEnd: '2025-05-18', subscriptionStatus: 'expired' },
  { id: '6', name: 'Kavita Nair', role: 'agent', email: 'kavita@transitpro.com', phone: '+91 43210 98765', company: 'Transit Pro Agency', plan: 'Basic', registrationDate: '2024-06-22', status: 'pending', address: '56 Marine Drive', city: 'Kochi', state: 'Kerala', gst: '32AABCK7890R1Z1', license: 'AG-2024-006', subscriptionStart: null, subscriptionEnd: null, subscriptionStatus: 'expired' },
  { id: '7', name: 'Rahul Mehta', role: 'dealer', email: 'rahul@cityauto.com', phone: '+91 32109 87654', company: 'City Auto Dealers', plan: 'Professional', registrationDate: '2024-07-30', status: 'active', address: '101 FC Road', city: 'Pune', state: 'Maharashtra', gst: '27AABCR2345R1Z8', license: 'DL-2024-007', subscriptionStart: '2024-07-30', subscriptionEnd: '2025-07-30', subscriptionStatus: 'active' },
  { id: '8', name: 'Anita Desai', role: 'agent', email: 'anita@fleetmgmt.com', phone: '+91 21098 76543', company: 'Fleet Management Co', plan: 'Enterprise', registrationDate: '2024-08-14', status: 'active', address: '33 Brigade Road', city: 'Bangalore', state: 'Karnataka', gst: '29AABCD6789R1Z2', license: 'AG-2024-008', subscriptionStart: '2024-08-14', subscriptionEnd: '2025-08-14', subscriptionStatus: 'active' },
]

export const mockRequests = [
  { id: 'REQ-001', userId: '3', userName: 'Amit Patel', type: 'New Registration', date: '2024-11-01', status: 'pending', priority: 'high' },
  { id: 'REQ-002', userId: '6', userName: 'Kavita Nair', type: 'Document Verification', date: '2024-11-02', status: 'pending', priority: 'medium' },
  { id: 'REQ-003', userId: '1', userName: 'Rajesh Kumar', type: 'Subscription Request', date: '2024-11-03', status: 'approved', priority: 'low' },
  { id: 'REQ-004', userId: '4', userName: 'Sneha Reddy', type: 'Support Ticket', date: '2024-11-04', status: 'in_progress', priority: 'urgent' },
  { id: 'REQ-005', userId: '5', userName: 'Vikram Singh', type: 'Document Verification', date: '2024-11-05', status: 'rejected', priority: 'medium' },
  { id: 'REQ-006', userId: '2', userName: 'Priya Sharma', type: 'New Registration', date: '2024-11-06', status: 'approved', priority: 'low' },
  { id: 'REQ-007', userId: '7', userName: 'Rahul Mehta', type: 'Subscription Request', date: '2024-11-07', status: 'pending', priority: 'high' },
  { id: 'REQ-008', userId: '8', userName: 'Anita Desai', type: 'Support Ticket', date: '2024-11-08', status: 'in_progress', priority: 'medium' },
]

export const mockNotifications = [
  { id: '1', title: 'New Dealer Registered', message: 'Amit Patel from Speed Motors has registered.', type: 'registration', read: false, date: '2024-11-08T10:30:00' },
  { id: '2', title: 'New Agent Registered', message: 'Kavita Nair from Transit Pro Agency has registered.', type: 'registration', read: false, date: '2024-11-08T09:15:00' },
  { id: '3', title: 'Subscription Expiring', message: 'Sneha Reddy subscription expires in 7 days.', type: 'subscription', read: false, date: '2024-11-07T14:00:00' },
  { id: '4', title: 'New Request Generated', message: 'REQ-007: Subscription Request from Rahul Mehta.', type: 'request', read: true, date: '2024-11-07T11:45:00' },
  { id: '5', title: 'User Suspended', message: 'Vikram Singh account has been suspended.', type: 'user', read: true, date: '2024-11-06T16:20:00' },
  { id: '6', title: 'Document Verified', message: 'Priya Sharma documents have been verified.', type: 'verification', read: true, date: '2024-11-05T13:10:00' },
]

export const mockActivityLogs = [
  { id: '1', action: 'User Created', user: 'Amit Patel', date: '2024-11-08T10:30:00', admin: 'Super Admin' },
  { id: '2', action: 'Dealer Approved', user: 'Rajesh Kumar', date: '2024-11-07T15:00:00', admin: 'Super Admin' },
  { id: '3', action: 'Subscription Renewed', user: 'Priya Sharma', date: '2024-11-06T12:30:00', admin: 'Super Admin' },
  { id: '4', action: 'Agent Suspended', user: 'Vikram Singh', date: '2024-11-05T09:45:00', admin: 'Super Admin' },
  { id: '5', action: 'Request Approved', user: 'Priya Sharma', date: '2024-11-04T14:20:00', admin: 'Super Admin' },
  { id: '6', action: 'Request Rejected', user: 'Vikram Singh', date: '2024-11-03T11:00:00', admin: 'Super Admin' },
]

export const mockStats = {
  totalDealers: { count: 342, growth: 12.5 },
  totalAgents: { count: 518, growth: 8.3 },
  activeSubscriptions: { count: 756, growth: 15.2 },
  pendingRequests: { count: 23, growth: -4.1 },
}

export const dealerGrowthData = [
  { month: 'Jan', dealers: 240 }, { month: 'Feb', dealers: 255 }, { month: 'Mar', dealers: 268 },
  { month: 'Apr', dealers: 280 }, { month: 'May', dealers: 295 }, { month: 'Jun', dealers: 310 },
  { month: 'Jul', dealers: 318 }, { month: 'Aug', dealers: 325 }, { month: 'Sep', dealers: 332 },
  { month: 'Oct', dealers: 338 }, { month: 'Nov', dealers: 342 },
]

export const agentGrowthData = [
  { month: 'Jan', agents: 380 }, { month: 'Feb', agents: 395 }, { month: 'Mar', agents: 410 },
  { month: 'Apr', agents: 425 }, { month: 'May', agents: 440 }, { month: 'Jun', agents: 455 },
  { month: 'Jul', agents: 468 }, { month: 'Aug', agents: 480 }, { month: 'Sep', agents: 492 },
  { month: 'Oct', agents: 505 }, { month: 'Nov', agents: 518 },
]

export const revenueData = [
  { month: 'Jan', revenue: 1250000 }, { month: 'Feb', revenue: 1380000 }, { month: 'Mar', revenue: 1420000 },
  { month: 'Apr', revenue: 1560000 }, { month: 'May', revenue: 1680000 }, { month: 'Jun', revenue: 1750000 },
  { month: 'Jul', revenue: 1820000 }, { month: 'Aug', revenue: 1900000 }, { month: 'Sep', revenue: 1980000 },
  { month: 'Oct', revenue: 2050000 }, { month: 'Nov', revenue: 2180000 },
]

export const registrationData = [
  { month: 'Jan', dealers: 28, agents: 35 }, { month: 'Feb', dealers: 32, agents: 38 },
  { month: 'Mar', dealers: 25, agents: 42 }, { month: 'Apr', dealers: 30, agents: 40 },
  { month: 'May', dealers: 35, agents: 45 }, { month: 'Jun', dealers: 28, agents: 38 },
  { month: 'Jul', dealers: 22, agents: 32 }, { month: 'Aug', dealers: 26, agents: 35 },
  { month: 'Sep', dealers: 30, agents: 40 }, { month: 'Oct', dealers: 33, agents: 42 },
  { month: 'Nov', dealers: 38, agents: 48 },
]

export const mockPaymentHistory = [
  { id: '1', date: '2024-01-15', amount: 49999, plan: 'Enterprise', status: 'paid' },
  { id: '2', date: '2023-01-15', amount: 49999, plan: 'Enterprise', status: 'paid' },
  { id: '3', date: '2022-01-15', amount: 44999, plan: 'Professional', status: 'paid' },
]

export const mockAdmin = {
  id: 'admin-1',
  name: 'Super Admin',
  email: 'admin@rto.gov.in',
  role: 'super_admin',
  avatar: null,
}
