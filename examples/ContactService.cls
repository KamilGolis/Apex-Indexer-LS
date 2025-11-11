public class ContactService {
    
    // Reference to AccountService
    public static List<Contact> getContactsForAccount(Id accountId) {
        Account acc = AccountService.getAccountById(accountId);
        
        if (acc != null) {
            return [SELECT Id, FirstName, LastName FROM Contact WHERE AccountId = :accountId];
        }
        
        return new List<Contact>();
    }
    
    // Create contact
    public static Contact createContact(String firstName, String lastName, Id accountId) {
        Contact con = new Contact(
            FirstName = firstName,
            LastName = lastName,
            AccountId = accountId
        );
        insert con;
        return con;
    }
}
