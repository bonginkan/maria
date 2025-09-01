-- PostgreSQL Initialization Script for Graph RAG 10T POC
-- Creates sample tables with test data for POC demonstration

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS public;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS board_decisions CASCADE;
DROP TABLE IF EXISTS survey_responses CASCADE;
DROP TABLE IF EXISTS vendor_contracts CASCADE;
DROP TABLE IF EXISTS patent_registry CASCADE;
DROP TABLE IF EXISTS project_milestones CASCADE;
DROP TABLE IF EXISTS employee_master CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS sales_2024 CASCADE;

-- Sales data table
CREATE TABLE sales_2024 (
    id SERIAL PRIMARY KEY,
    product VARCHAR(255) NOT NULL,
    revenue DECIMAL(12, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    quarter VARCHAR(10) NOT NULL,
    year INTEGER NOT NULL,
    region VARCHAR(100),
    sales_person VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample sales data
INSERT INTO sales_2024 (product, revenue, quantity, quarter, year, region, sales_person) VALUES
('Product A', 150000.00, 100, 'Q1', 2024, 'North', 'John Smith'),
('Product B', 200000.00, 150, 'Q1', 2024, 'South', 'Jane Doe'),
('Product C', 175000.00, 120, 'Q2', 2024, 'East', 'Mike Johnson'),
('Product A', 180000.00, 110, 'Q2', 2024, 'West', 'Sarah Williams'),
('Product D', 250000.00, 200, 'Q3', 2024, 'North', 'John Smith'),
('Product E', 195000.00, 140, 'Q3', 2024, 'South', 'Jane Doe'),
('Product B', 220000.00, 165, 'Q4', 2024, 'East', 'Mike Johnson'),
('Product C', 190000.00, 130, 'Q4', 2024, 'West', 'Sarah Williams');

-- Customers table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    contact_email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample customers
INSERT INTO customers (name, industry, contact_email, phone, address, city, country, status) VALUES
('Acme Corporation', 'Technology', 'contact@acme.com', '+1-555-0100', '123 Tech Street', 'San Francisco', 'USA', 'active'),
('Global Industries Inc', 'Finance', 'info@global.com', '+1-555-0200', '456 Wall Street', 'New York', 'USA', 'active'),
('Sakura Technologies', 'Manufacturing', 'hello@sakura.jp', '+81-3-5555-0100', '789 Shibuya', 'Tokyo', 'Japan', 'active'),
('European Solutions Ltd', 'Consulting', 'contact@eurosol.eu', '+44-20-5555-0100', '321 Oxford Street', 'London', 'UK', 'active'),
('Pacific Traders', 'Retail', 'sales@pacific.au', '+61-2-5555-0100', '654 Harbor Road', 'Sydney', 'Australia', 'active');

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    product_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    price DECIMAL(10, 2),
    stock_quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample products
INSERT INTO products (product_code, name, description, category, price, stock_quantity) VALUES
('PROD-A', 'Product A', 'Enterprise software solution', 'Software', 1500.00, 100),
('PROD-B', 'Product B', 'Cloud storage service', 'Cloud', 2000.00, 150),
('PROD-C', 'Product C', 'Security monitoring tool', 'Security', 1750.00, 80),
('PROD-D', 'Product D', 'Data analytics platform', 'Analytics', 2500.00, 60),
('PROD-E', 'Product E', 'Mobile application suite', 'Mobile', 1950.00, 120);

-- Support tickets table
CREATE TABLE support_tickets (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    subject VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'open',
    priority VARCHAR(20) DEFAULT 'medium',
    assigned_to VARCHAR(255),
    resolution TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample support tickets
INSERT INTO support_tickets (ticket_number, customer_id, subject, description, status, priority, assigned_to) VALUES
('TICK-001', 1, 'Login issue with enterprise portal', 'Users cannot access the dashboard', 'resolved', 'high', 'Tech Support Team'),
('TICK-002', 2, 'Performance degradation in API', 'API response times increased significantly', 'open', 'high', 'Engineering Team'),
('TICK-003', 3, 'Feature request: Export to Excel', 'Need ability to export reports to Excel format', 'pending', 'medium', 'Product Team'),
('TICK-004', 4, 'Billing discrepancy', 'Invoice amount does not match usage', 'in_progress', 'high', 'Billing Team'),
('TICK-005', 5, 'Mobile app crash on iOS 17', 'App crashes when opening settings', 'open', 'critical', 'Mobile Team');

-- Employee master table
CREATE TABLE employee_master (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    department VARCHAR(100),
    position VARCHAR(100),
    manager_id INTEGER REFERENCES employee_master(id),
    hire_date DATE,
    salary DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample employees
INSERT INTO employee_master (employee_id, first_name, last_name, email, department, position, hire_date, salary) VALUES
('EMP001', 'John', 'Smith', 'john.smith@company.com', 'Sales', 'Sales Manager', '2020-01-15', 85000),
('EMP002', 'Jane', 'Doe', 'jane.doe@company.com', 'Sales', 'Senior Sales Rep', '2021-03-20', 65000),
('EMP003', 'Mike', 'Johnson', 'mike.johnson@company.com', 'Engineering', 'Tech Lead', '2019-06-10', 120000),
('EMP004', 'Sarah', 'Williams', 'sarah.williams@company.com', 'Marketing', 'Marketing Director', '2018-09-05', 95000),
('EMP005', 'Tom', 'Brown', 'tom.brown@company.com', 'HR', 'HR Manager', '2022-01-10', 75000);

-- Project milestones table
CREATE TABLE project_milestones (
    id SERIAL PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    milestone_name VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE,
    completion_date DATE,
    status VARCHAR(50) DEFAULT 'planned',
    assigned_team VARCHAR(100),
    budget DECIMAL(12, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample project milestones
INSERT INTO project_milestones (project_name, milestone_name, description, due_date, status, assigned_team, budget) VALUES
('AI Platform Development', 'Phase 1: Research', 'Complete AI model research and selection', '2024-03-31', 'completed', 'AI Team', 50000),
('AI Platform Development', 'Phase 2: Prototype', 'Build working prototype', '2024-06-30', 'in_progress', 'AI Team', 150000),
('AI Platform Development', 'Phase 3: Testing', 'Comprehensive testing and validation', '2024-09-30', 'planned', 'QA Team', 75000),
('Cloud Migration', 'Infrastructure Setup', 'Setup cloud infrastructure', '2024-04-15', 'completed', 'DevOps', 100000),
('Cloud Migration', 'Data Migration', 'Migrate all data to cloud', '2024-07-31', 'in_progress', 'Data Team', 200000);

-- Patent registry table
CREATE TABLE patent_registry (
    id SERIAL PRIMARY KEY,
    patent_number VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    inventors TEXT,
    filing_date DATE,
    grant_date DATE,
    status VARCHAR(50) DEFAULT 'pending',
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample patents
INSERT INTO patent_registry (patent_number, title, description, inventors, filing_date, status, category) VALUES
('US-2024-001', 'Machine Learning Data Processing System', 'Novel approach to ML data preprocessing', 'John Doe, Jane Smith', '2024-01-15', 'pending', 'AI/ML'),
('US-2024-002', 'Distributed Cache Architecture', 'Improved caching mechanism for distributed systems', 'Mike Johnson', '2024-02-20', 'pending', 'Infrastructure'),
('US-2023-101', 'Quantum Encryption Method', 'Quantum-resistant encryption algorithm', 'Sarah Williams, Tom Brown', '2023-11-10', 'granted', 'Security');

-- Vendor contracts table
CREATE TABLE vendor_contracts (
    id SERIAL PRIMARY KEY,
    contract_number VARCHAR(100) UNIQUE NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    total_value DECIMAL(12, 2),
    payment_terms VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    renewal_option BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample vendor contracts
INSERT INTO vendor_contracts (contract_number, vendor_name, description, start_date, end_date, total_value, payment_terms, status) VALUES
('CONTRACT-2024-001', 'CloudTech Solutions', 'Cloud infrastructure services', '2024-01-01', '2024-12-31', 500000, 'Monthly', 'active'),
('CONTRACT-2024-002', 'SecureNet Inc', 'Security monitoring and response', '2024-02-01', '2025-01-31', 300000, 'Quarterly', 'active'),
('CONTRACT-2023-050', 'DataAnalytics Pro', 'BI and analytics tools', '2023-06-01', '2024-05-31', 150000, 'Annual', 'expiring'),
('CONTRACT-2024-003', 'DevTools Corp', 'Development tools and licenses', '2024-03-01', '2025-02-28', 100000, 'Annual', 'active');

-- Board decisions table
CREATE TABLE board_decisions (
    id SERIAL PRIMARY KEY,
    decision_number VARCHAR(50) UNIQUE NOT NULL,
    meeting_date DATE NOT NULL,
    subject VARCHAR(500) NOT NULL,
    decision_text TEXT,
    vote_result VARCHAR(100),
    implementation_deadline DATE,
    responsible_party VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample board decisions
INSERT INTO board_decisions (decision_number, meeting_date, subject, decision_text, vote_result, implementation_deadline, responsible_party, status) VALUES
('BD-2024-001', '2024-01-15', 'Approval of AI Strategy', 'Board approves the 3-year AI transformation strategy', 'Unanimous', '2024-12-31', 'CTO', 'in_progress'),
('BD-2024-002', '2024-02-15', 'Budget Allocation for R&D', 'Increase R&D budget by 25% for FY2024', '8-2 in favor', '2024-03-31', 'CFO', 'completed'),
('BD-2024-003', '2024-03-15', 'New Market Expansion', 'Approve expansion into European markets', '7-3 in favor', '2024-09-30', 'COO', 'planning');

-- Survey responses table
CREATE TABLE survey_responses (
    id SERIAL PRIMARY KEY,
    survey_id VARCHAR(50) NOT NULL,
    respondent_id VARCHAR(100),
    survey_type VARCHAR(100),
    department VARCHAR(100),
    overall_satisfaction INTEGER CHECK (overall_satisfaction >= 1 AND overall_satisfaction <= 10),
    comments TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample survey responses
INSERT INTO survey_responses (survey_id, respondent_id, survey_type, department, overall_satisfaction, comments) VALUES
('SURVEY-2024-Q1', 'RESP001', 'Employee Satisfaction', 'Engineering', 8, 'Good work environment, need better tools'),
('SURVEY-2024-Q1', 'RESP002', 'Employee Satisfaction', 'Sales', 7, 'Would like more training opportunities'),
('SURVEY-2024-Q1', 'RESP003', 'Employee Satisfaction', 'HR', 9, 'Excellent company culture'),
('SURVEY-2024-Q1', 'RESP004', 'Employee Satisfaction', 'Marketing', 6, 'Need clearer career progression path'),
('SURVEY-2024-Q1', 'RESP005', 'Employee Satisfaction', 'Engineering', 8, 'Great team collaboration');

-- Create indexes for better performance
CREATE INDEX idx_sales_quarter_year ON sales_2024(quarter, year);
CREATE INDEX idx_support_status ON support_tickets(status);
CREATE INDEX idx_employee_department ON employee_master(department);
CREATE INDEX idx_project_status ON project_milestones(status);
CREATE INDEX idx_contracts_end_date ON vendor_contracts(end_date);
CREATE INDEX idx_survey_type ON survey_responses(survey_type);

-- Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to all tables
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales_2024 FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employee_master FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON project_milestones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_patents_updated_at BEFORE UPDATE ON patent_registry FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON vendor_contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_decisions_updated_at BEFORE UPDATE ON board_decisions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dbuser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dbuser;

ANALYZE;

-- Summary
SELECT 
    'Database initialized successfully' as status,
    (SELECT COUNT(*) FROM sales_2024) as sales_records,
    (SELECT COUNT(*) FROM customers) as customers,
    (SELECT COUNT(*) FROM products) as products,
    (SELECT COUNT(*) FROM support_tickets) as tickets,
    (SELECT COUNT(*) FROM employee_master) as employees;