package com.agrolink.patterns.adapter;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

/** Adapter wrapping raw HTTP calls to Supabase REST endpoints. */
public class SupabaseClientAdapter {
  private final HttpClient client = HttpClient.newHttpClient();
  private final String baseUrl;
  private final String serviceKey;

  public SupabaseClientAdapter(String baseUrl, String serviceKey){
    this.baseUrl = baseUrl; this.serviceKey = serviceKey;
  }

  public String get(String path){
    try {
      HttpRequest req = HttpRequest.newBuilder(URI.create(baseUrl + path))
        .header("apikey", serviceKey)
        .GET().build();
      HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
      return resp.body();
    } catch (Exception e){
      throw new RuntimeException(e);
    }
  }
}
