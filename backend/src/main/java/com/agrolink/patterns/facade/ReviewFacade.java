package com.agrolink.patterns.facade;

import com.agrolink.patterns.builder.ReviewDraft;
import com.agrolink.patterns.singleton.ProfanityDictionary;
import com.agrolink.patterns.bridge.ReviewPersistence;
import com.agrolink.patterns.bridge.Summary;

import java.time.Instant;

/** Facade orchestrating moderation, persistence and summary retrieval. */
public class ReviewFacade {
  private final ReviewPersistence persistence = new ReviewPersistence();

  public record CreatedReview(String id, String productId, String buyerId, int rating, String moderatedComment, Instant createdAt){}
  public record RatingSummary(double average, int count){}

  public CreatedReview createReview(ReviewDraft draft){
    // moderation via singleton dictionary
    String moderated = ProfanityDictionary.get().moderate(draft.comment());
    String id = persistence.save(draft.productId(), draft.buyerId(), draft.rating(), moderated);
    return new CreatedReview(id, draft.productId(), draft.buyerId(), draft.rating(), moderated, Instant.now());
  }

  public RatingSummary getSummary(String productId){
    Summary s = persistence.summary(productId);
    return new RatingSummary(s.average, s.count);
  }
}
