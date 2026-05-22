import java.sql.*;

public class CheckLogs {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:h2:file:./example_db";
        Connection conn = DriverManager.getConnection(url, "sa", "");
        Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery("SELECT * FROM operation_logs ORDER BY operation_time DESC LIMIT 5");
        System.out.println("--- Last 5 Operation Logs ---");
        while (rs.next()) {
            System.out.println(rs.getTimestamp("operation_time") + " | " + rs.getString("user_name") + " | " + rs.getString("action_type") + " | " + rs.getString("log_type"));
        }
        conn.close();
    }
}
