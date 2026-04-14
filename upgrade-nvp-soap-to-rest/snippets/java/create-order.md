#### Create an order

```java
public static class CreateOrderResult {
    public String orderId;
    public String approvalUrl;
    
    public CreateOrderResult(String orderId, String approvalUrl) {
        this.orderId = orderId;
        this.approvalUrl = approvalUrl;
    }
}

public static CreateOrderResult createOrder() throws IOException, InterruptedException {
    try {
        String accessToken = getAccessToken();
        String createOrderUrl = BASE_URL + "/v2/checkout/orders";
        Map<String, Object> intentCapture = new HashMap<>();
        intentCapture.put("intent", "CAPTURE"); // Legacy equivalents — NVP: PAYMENTREQUEST_n_PAYMENTACTION or PAYMENTACTION ; SOAP: PaymentDetails.PaymentAction
        
        Map<String, Object> icAmount = new HashMap<>();
        icAmount.put("currency_code", "USD"); // Legacy equivalents — NVP: CURRENCYCODE ; SOAP: PaymentDetails.OrderTotal.currencyID
        icAmount.put("value", "10.00"); // Legacy equivalents — NVP: AMT ; SOAP: PaymentDetails.OrderTotal
        
        Map<String, Object> icPurchaseUnit = new HashMap<>();
        icPurchaseUnit.put("amount", icAmount);
        
        Map<String, Object> icExperienceContext = new HashMap<>();
        icExperienceContext.put("return_url", "http://localhost:3000/scenario/complete"); // Legacy equivalents — NVP: RETURNURL ; SOAP: ReturnURL
        icExperienceContext.put("cancel_url", "http://localhost:3000/scenario/cancel"); // Legacy equivalents — NVP: CANCELURL ; SOAP: CancelURL
        
        Map<String, Object> icPaypal = new HashMap<>();
        icPaypal.put("experience_context", icExperienceContext);
        
        Map<String, Object> icPaymentSource = new HashMap<>();
        icPaymentSource.put("paypal", icPaypal);
        
        intentCapture.put("purchase_units", new Object[]{icPurchaseUnit});
        intentCapture.put("payment_source", icPaymentSource);
        String jsonPayload = gson.toJson(intentCapture);
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(createOrderUrl))
            .header("Authorization", "Bearer " + accessToken)
            .header("PayPal-Request-Id", UUID.randomUUID().toString())
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
            .build();
        
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() >= 400) {
            JsonObject errorResponse = JsonParser.parseString(response.body()).getAsJsonObject();
            String debugId = errorResponse.has("debug_id") ? errorResponse.get("debug_id").getAsString() : "N/A";
            System.out.println("Error debug id: " + debugId);
            throw new IOException("Request failed with status code " + response.statusCode());
        }
        
        JsonObject jsonResponse = JsonParser.parseString(response.body()).getAsJsonObject();
        String orderId = jsonResponse.get("id").getAsString();
        String approvalUrl = null;
        // Approval URL is returned as "payer-action" if "payment_source" was mentioned during order creation.
        // If "payment_source" was not mentioned, it is returned as "approve" in the HATEOAS links.
        if (jsonResponse.has("links")) {
            JsonArray links = jsonResponse.getAsJsonArray("links");
            for (JsonElement link : links) {
                JsonObject linkObj = link.getAsJsonObject();
                String rel = linkObj.get("rel").getAsString();
                if (rel.equals("approve") || rel.equals("payer-action")) {
                    approvalUrl = linkObj.get("href").getAsString();
                    break;
                }
            }
        }
        
        return new CreateOrderResult(orderId, approvalUrl);
    } catch (Exception e) {
        System.out.println("Error: " + e.getMessage());
        throw e;
    }
}
```