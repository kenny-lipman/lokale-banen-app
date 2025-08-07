# Bufferzone UI Specification
*Detailed UI/UX Design for Company → Contact → Campaign Workflow*

## 🎯 **Overview**

The Bufferzone is a unified interface that combines scraped companies and their associated contacts into a hierarchical, expandable view. Users can efficiently manage the workflow from company scraping → contact scraping → campaign assignment in a single, intuitive interface.

## 🏗️ **Information Architecture**

### **Data Hierarchy**
```
Bufferzone
├── Company A (5 contacts) [Expand] [Select All] [Scrape Contacts]
│   ├── Contact 1: John Smith - CEO - john@company.com [Select] [Assign]
│   ├── Contact 2: Sarah Johnson - HR - sarah@company.com [Select] [Assign]
│   └── Contact 3: Mike Davis - Sales - mike@company.com [Select] [Assign]
├── Company B (12 contacts) [Expand] [Select All] [Scrape Contacts]
│   ├── Contact 1: Lisa Brown - Marketing - lisa@company.com [Select] [Assign]
│   └── Contact 2: Tom Wilson - Operations - tom@company.com [Select] [Assign]
└── Company C (3 contacts) [Expand] [Select All] [Scrape Contacts]
    └── Contact 1: Anna Garcia - Finance - anna@company.com [Select] [Assign]
```

## 🎨 **Visual Design System**

### **Color Palette**
- **Primary Brand**: Orange (`#f97316`) - Company actions, selection states
- **Success**: Green (`#22c55e`) - Completed scraping, assigned contacts
- **Warning**: Yellow (`#eab308`) - In progress, pending actions
- **Error**: Red (`#ef4444`) - Failed scraping, errors
- **Neutral**: Gray (`#6b7280`) - Default states, disabled items
- **Background**: Light gray (`#f9fafb`) - Subtle row alternation

### **Typography**
- **Company Names**: `font-semibold text-base` - Clear hierarchy
- **Contact Names**: `font-medium text-sm` - Readable but secondary
- **Status Text**: `text-xs` - Compact status indicators
- **Counts**: `text-sm text-gray-600` - Subtle but informative

## 📱 **Component Specifications**

### **1. Bufferzone Header**

```tsx
<div className="flex justify-between items-center p-4 border-b bg-white">
  <div className="flex items-center gap-3">
    <h1 className="text-2xl font-bold">Bufferzone</h1>
    <Badge variant="secondary">{totalCompanies} Companies</Badge>
    <Badge variant="secondary">{totalContacts} Contacts</Badge>
  </div>
  
  <div className="flex items-center gap-2">
    <Button variant="outline" size="sm">
      <RefreshCw className="w-4 h-4 mr-2" />
      Refresh
    </Button>
    <Button variant="outline" size="sm">
      <Filter className="w-4 h-4 mr-2" />
      Filter
    </Button>
    <Button size="sm">
      <Users className="w-4 h-4 mr-2" />
      Bulk Assign
    </Button>
  </div>
</div>
```

### **2. Filter & Search Bar**

```tsx
<div className="p-4 bg-gray-50 border-b">
  <div className="flex gap-4 items-center">
    <div className="flex-1">
      <Input 
        placeholder="Search companies or contacts..."
        className="max-w-md"
        icon={<Search className="w-4 h-4" />}
      />
    </div>
    
    <Select defaultValue="all">
      <option value="all">All Status</option>
      <option value="scraped">Scraped</option>
      <option value="pending">Pending</option>
      <option value="failed">Failed</option>
    </Select>
    
    <Select defaultValue="all">
      <option value="all">All Companies</option>
      <option value="with-contacts">With Contacts</option>
      <option value="without-contacts">Without Contacts</option>
    </Select>
  </div>
</div>
```

### **3. Company Row (Parent Level)**

```tsx
<TableRow className="bg-orange-50 hover:bg-orange-100 border-b">
  <TableCell className="w-12">
    <Checkbox 
      checked={companySelected}
      onChange={handleCompanySelect}
      aria-label={`Select all contacts for ${company.name}`}
    />
  </TableCell>
  
  <TableCell className="w-12">
    <button
      onClick={toggleExpanded}
      className="p-1 hover:bg-orange-200 rounded"
      aria-label={expanded ? "Collapse" : "Expand"}
    >
      {expanded ? (
        <ChevronDown className="w-4 h-4 text-orange-600" />
      ) : (
        <ChevronRight className="w-4 h-4 text-orange-600" />
      )}
    </button>
  </TableCell>
  
  <TableCell className="font-semibold">
    <div className="flex items-center gap-2">
      <span className="text-base">{company.name}</span>
      <Badge variant="outline" className="text-xs">
        {company.contactCount} contacts
      </Badge>
      {company.hasJobPostings && (
        <Badge variant="secondary" className="text-xs">
          {company.jobPostingCount} jobs
        </Badge>
      )}
    </div>
    <div className="text-sm text-gray-600 mt-1">
      {company.location} • {company.industry}
    </div>
  </TableCell>
  
  <TableCell>
    <div className="flex items-center gap-2">
      <StatusBadge status={company.scrapingStatus} />
      {company.lastScraped && (
        <span className="text-xs text-gray-500">
          {formatDate(company.lastScraped)}
        </span>
      )}
    </div>
  </TableCell>
  
  <TableCell>
    <div className="flex items-center gap-2">
      {company.contactCount > 0 ? (
        <Badge variant="success" className="text-xs">
          {company.assignedContacts} assigned
        </Badge>
      ) : (
        <Button 
          size="sm" 
          variant="outline"
          onClick={handleScrapeContacts}
          disabled={company.scrapingInProgress}
        >
          {company.scrapingInProgress ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Users className="w-3 h-3 mr-1" />
          )}
          Scrape Contacts
        </Button>
      )}
    </div>
  </TableCell>
  
  <TableCell className="w-20">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handleBulkAssign}>
          <Send className="w-4 h-4 mr-2" />
          Assign All to Campaign
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCompany}>
          <Download className="w-4 h-4 mr-2" />
          Export Contacts
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleViewDetails}>
          <Eye className="w-4 h-4 mr-2" />
          View Details
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </TableCell>
</TableRow>
```

### **4. Contact Row (Child Level)**

```tsx
<TableRow className="bg-white hover:bg-gray-50 border-b">
  <TableCell className="w-12 pl-8">
    <Checkbox 
      checked={contactSelected}
      onChange={handleContactSelect}
      aria-label={`Select ${contact.name}`}
    />
  </TableCell>
  
  <TableCell className="w-12"></TableCell>
  
  <TableCell>
    <div className="flex items-center gap-3">
      <Avatar className="w-8 h-8">
        <AvatarFallback className="text-xs">
          {getInitials(contact.name)}
        </AvatarFallback>
      </Avatar>
      <div>
        <div className="font-medium text-sm">{contact.name}</div>
        <div className="text-xs text-gray-600">{contact.role}</div>
      </div>
      {contact.isKeyContact && (
        <Badge variant="outline" className="text-xs">
          Key Contact
        </Badge>
      )}
    </div>
  </TableCell>
  
  <TableCell>
    <div className="text-sm">
      <div>{contact.email}</div>
      {contact.phone && (
        <div className="text-xs text-gray-600">{contact.phone}</div>
      )}
    </div>
  </TableCell>
  
  <TableCell>
    <div className="flex items-center gap-2">
      <StatusBadge status={contact.scrapingStatus} />
      {contact.assignedCampaign && (
        <Badge variant="success" className="text-xs">
          {contact.assignedCampaign}
        </Badge>
      )}
    </div>
  </TableCell>
  
  <TableCell>
    <div className="flex items-center gap-2">
      {contact.assignedCampaign ? (
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => handleChangeCampaign(contact)}
        >
          <Edit className="w-3 h-3 mr-1" />
          Change
        </Button>
      ) : (
        <Button 
          size="sm"
          onClick={() => handleAssignContact(contact)}
        >
          <Send className="w-3 h-3 mr-1" />
          Assign
        </Button>
      )}
    </div>
  </TableCell>
  
  <TableCell className="w-20">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => handleViewContact(contact)}>
          <Eye className="w-4 h-4 mr-2" />
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleEditContact(contact)}>
          <Edit className="w-4 h-4 mr-2" />
          Edit Contact
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleRescrapeContact(contact)}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Re-scrape
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </TableCell>
</TableRow>
```

### **5. Status Badge Component**

```tsx
const StatusBadge = ({ status }: { status: string }) => {
  const variants = {
    scraped: "bg-green-100 text-green-800 border-green-200",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    failed: "bg-red-100 text-red-800 border-red-200",
    inProgress: "bg-blue-100 text-blue-800 border-blue-200"
  };
  
  const icons = {
    scraped: <Check className="w-3 h-3" />,
    pending: <Clock className="w-3 h-3" />,
    failed: <X className="w-3 h-3" />,
    inProgress: <Loader2 className="w-3 h-3 animate-spin" />
  };
  
  return (
    <Badge 
      variant="outline" 
      className={`text-xs flex items-center gap-1 ${variants[status]}`}
    >
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};
```

## 🔄 **Interaction Patterns**

### **1. Expand/Collapse Behavior**
- **Default State**: All companies collapsed
- **Search Trigger**: Auto-expand companies with matching contacts
- **Keyboard Support**: Enter/Space to expand, Escape to collapse
- **Visual Feedback**: Smooth animation with chevron rotation

### **2. Selection Patterns**
- **Company Selection**: Selects all contacts within that company
- **Contact Selection**: Individual contact selection
- **Mixed Selection**: Visual indication when some contacts selected
- **Bulk Actions**: Context-sensitive based on selection level

### **3. Bulk Operations**
- **Assign to Campaign**: Select multiple contacts → choose campaign
- **Export Contacts**: Export selected contacts to CSV
- **Re-scrape**: Re-scrape selected companies/contacts
- **Delete**: Remove selected items (with confirmation)

### **4. Progressive Disclosure**
- **Level 1**: Company overview with contact counts
- **Level 2**: Contact details when expanded
- **Level 3**: Detailed contact view in modal/sidebar

## 📊 **Data States & Loading**

### **1. Empty States**
```tsx
// No companies scraped
<div className="text-center py-12">
  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
  <h3 className="text-lg font-medium text-gray-900 mb-2">
    No companies in bufferzone
  </h3>
  <p className="text-gray-600 mb-4">
    Start by scraping companies from your Otis agent
  </p>
  <Button onClick={navigateToOtis}>
    <Play className="w-4 h-4 mr-2" />
    Go to Otis Agent
  </Button>
</div>

// Company with no contacts
<div className="text-center py-8">
  <UserPlus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
  <p className="text-sm text-gray-600 mb-2">
    No contacts scraped yet
  </p>
  <Button size="sm" variant="outline" onClick={handleScrapeContacts}>
    <Users className="w-3 h-3 mr-1" />
    Scrape Contacts
  </Button>
</div>
```

### **2. Loading States**
```tsx
// Company scraping in progress
<TableRow className="bg-yellow-50">
  <TableCell colSpan={6}>
    <div className="flex items-center gap-2 py-2">
      <Loader2 className="w-4 h-4 animate-spin text-yellow-600" />
      <span className="text-sm text-yellow-800">
        Scraping contacts for {company.name}...
      </span>
    </div>
  </TableCell>
</TableRow>
```

## 🎯 **Campaign Assignment Flow**

### **1. Individual Assignment**
```tsx
const CampaignAssignmentModal = ({ contact, onAssign }) => {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Contact to Campaign</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
            <Avatar className="w-10 h-10">
              <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{contact.name}</div>
              <div className="text-sm text-gray-600">{contact.email}</div>
            </div>
          </div>
          
          <div>
            <Label>Select Campaign</Label>
            <Select>
              {campaigns.map(campaign => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onAssign(contact, selectedCampaign)}>
            Assign to Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

### **2. Bulk Assignment**
```tsx
const BulkAssignmentModal = ({ selectedContacts, onAssign }) => {
  return (
    <Dialog>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Assign to Campaign</DialogTitle>
          <DialogDescription>
            Assign {selectedContacts.length} contacts to a campaign
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Select Campaign</Label>
            <Select>
              {campaigns.map(campaign => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </Select>
          </div>
          
          <div>
            <Label>Selected Contacts</Label>
            <div className="max-h-60 overflow-y-auto border rounded p-2">
              {selectedContacts.map(contact => (
                <div key={contact.id} className="flex items-center gap-2 py-1">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-xs">
                      {getInitials(contact.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{contact.name}</span>
                  <span className="text-xs text-gray-600">{contact.email}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onAssign(selectedContacts, selectedCampaign)}>
            Assign All to Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

## 📱 **Responsive Design**

### **Mobile Adaptations**
```tsx
// Mobile company row
<div className="block md:hidden">
  <div className="p-4 border-b bg-orange-50">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Checkbox checked={companySelected} onChange={handleCompanySelect} />
        <button onClick={toggleExpanded}>
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <span className="font-semibold">{company.name}</span>
      </div>
      <Badge variant="outline">{company.contactCount} contacts</Badge>
    </div>
    
    <div className="text-sm text-gray-600 mb-2">
      {company.location} • {company.industry}
    </div>
    
    <div className="flex items-center gap-2">
      <StatusBadge status={company.scrapingStatus} />
      {company.contactCount === 0 && (
        <Button size="sm" variant="outline" onClick={handleScrapeContacts}>
          Scrape Contacts
        </Button>
      )}
    </div>
  </div>
  
  {expanded && (
    <div className="bg-white">
      {company.contacts.map(contact => (
        <ContactCard key={contact.id} contact={contact} />
      ))}
    </div>
  )}
</div>
```

## ♿ **Accessibility Features**

### **1. Keyboard Navigation**
- Tab through interactive elements
- Enter/Space to expand/collapse
- Escape to close modals
- Arrow keys for selection

### **2. Screen Reader Support**
- Proper ARIA labels for expand/collapse
- Status announcements for loading states
- Descriptive text for all actions
- Clear hierarchy announcements

### **3. Focus Management**
- Focus moves to expanded content
- Focus returns to trigger after modal close
- Visible focus indicators
- Logical tab order

## 🚀 **Implementation Priority**

### **Phase 1: Core Functionality**
1. Basic expandable company rows
2. Contact display within companies
3. Simple selection and assignment
4. Status indicators

### **Phase 2: Enhanced UX**
1. Search and filtering
2. Bulk operations
3. Loading states and animations
4. Mobile responsiveness

### **Phase 3: Advanced Features**
1. Drag-and-drop assignment
2. Advanced filtering options
3. Export functionality
4. Performance optimizations

This specification provides a comprehensive foundation for building an intuitive, efficient Bufferzone interface that follows proven UX patterns and scales beautifully with your data! 🎯 