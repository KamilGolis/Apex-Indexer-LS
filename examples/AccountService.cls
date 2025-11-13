public class AccountService {
    
    // Find all accounts
    public static List<Account> getAllAccounts() {
        return [SELECT Id, Name FROM Account];
    }
    
    // Get account by ID
    public static Account getAccountById(Id accountId) {
        return [SELECT Id, Name, Phone FROM Account WHERE Id = :accountId LIMIT 1];
    }
    
    // Create a new account
    public static Account createAccount(String name, String phone) {
        Account acc = new Account(Name = name, Phone = phone);
        insert acc;
        return acc;
    }
    
    // Update account
    public static void updateAccount(Account acc) {
        update acc;
    }
}
