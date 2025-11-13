package com.agrolink.patterns.bridge;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Bridge pattern: Abstraction (ReviewPersistenceBridge) delegates to Implementor. */
public abstract class ReviewPersistenceBridge {
  protected final ReviewStore implementor;
  protected ReviewPersistenceBridge(ReviewStore store){ this.implementor = store; }
  public String save(String productId, String buyerId, int rating, String comment){ return implementor.save(productId, buyerId, rating, comment); }
  public Summary summary(String productId){ return implementor.summary(productId); }
}

interface ReviewStore {
  String save(String productId, String buyerId, int rating, String comment);
  Summary summary(String productId);
}

class Summary { public final double average; public final int count; public Summary(double a,int c){average=a;count=c;} }

class InMemoryReviewStore implements ReviewStore {
  record R(String productId, String buyerId, int rating, String comment, Instant createdAt){}
  private final List<R> data = new ArrayList<>();
  public String save(String productId, String buyerId, int rating, String comment){
    R r = new R(productId, buyerId, rating, comment, Instant.now());
    data.add(r);
    return "mem-"+data.size();
  }
  public Summary summary(String productId){
    int sum=0; int count=0;
    for (R r: data){ if(r.productId().equals(productId)){ sum+=r.rating(); count++; } }
    return new Summary(count==0?0: (double)sum/count, count);
  }
}

class ReviewPersistence extends ReviewPersistenceBridge {
  public ReviewPersistence(){ super(new InMemoryReviewStore()); }
}
