package com.agrolink.patterns.decorator;

import com.agrolink.patterns.singleton.ProfanityDictionary;
import com.agrolink.patterns.bridge.Summary;

/** Decorator wrapping a store to sanitize and collect metrics. */
public class DecoratedReviewStore implements ReviewStoreComponent {
  private final ReviewStoreComponent delegate;
  private long moderatedCount = 0;
  public DecoratedReviewStore(ReviewStoreComponent delegate){ this.delegate = delegate; }
  public String save(String productId, String buyerId, int rating, String comment){
    String moderated = ProfanityDictionary.get().moderate(comment);
    if(!moderated.equals(comment)) moderatedCount++;
    return delegate.save(productId, buyerId, rating, moderated);
  }
  public Summary summary(String productId){ return delegate.summary(productId); }
  public long getModeratedCount(){ return moderatedCount; }
}

interface ReviewStoreComponent {
  String save(String productId, String buyerId, int rating, String comment);
  Summary summary(String productId);
}
