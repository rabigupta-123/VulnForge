"""
Database Cleanup Script for CyberGuardian AI.

Audits and cleans:
1. Duplicate Asset records (same org_id and domain). Keeps the verified or oldest asset, removes duplicates.
2. Orphaned Scan records (pointing to asset IDs that no longer exist).
3. Orphaned Finding records (pointing to scan IDs that no longer exist).

Usage:
    python db_cleanup.py --dry-run   (Only inspect and log duplicate/orphaned rows)
    python db_cleanup.py --execute   (Perform deletion of orphaned/duplicate rows)
"""

import sys
import argparse
import logging
from sqlalchemy import func
from app.core.database import SessionLocal, engine
from app.models.asset import Asset
from app.models.scan import Scan, Finding

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("db_cleanup")


def audit_and_cleanup(dry_run: bool = True):
    db = SessionLocal()
    try:
        logger.info(f"Starting Database Consistency Audit (dry_run={dry_run})...")

        # 1. Audit Duplicate Assets (same org_id & domain)
        duplicate_groups = (
            db.query(Asset.org_id, Asset.domain, func.count(Asset.id))
            .group_by(Asset.org_id, Asset.domain)
            .having(func.count(Asset.id) > 1)
            .all()
        )

        deleted_assets_count = 0
        for org_id, domain, count in duplicate_groups:
            logger.info(f"Found duplicate asset group: org_id={org_id}, domain={domain} (count={count})")
            assets = (
                db.query(Asset)
                .filter(Asset.org_id == org_id, Asset.domain == domain)
                .order_by(Asset.created_at.asc())
                .all()
            )

            # Prefer keeping a verified asset, otherwise the first created
            keeper = None
            for a in assets:
                if a.verification_status == "verified":
                    keeper = a
                    break
            if not keeper:
                keeper = assets[0]

            duplicates = [a for a in assets if a.id != keeper.id]
            logger.info(f"  Keeping Asset ID {keeper.id} (status: {keeper.verification_status}). Removing {len(duplicates)} duplicates.")

            for dup in duplicates:
                deleted_assets_count += 1
                if not dry_run:
                    # Reassign or delete scans linked to duplicate asset
                    db.query(Scan).filter(Scan.asset_id == dup.id).update({"asset_id": keeper.id}, synchronize_session=False)
                    db.delete(dup)

        # 2. Audit Orphaned Scans (asset_id not matching any Asset)
        asset_ids = [a.id for a in db.query(Asset.id).all()]
        orphaned_scans = db.query(Scan).filter(~Scan.asset_id.in_(asset_ids)).all() if asset_ids else db.query(Scan).all()
        logger.info(f"Found {len(orphaned_scans)} orphaned Scan records.")

        if not dry_run:
            for s in orphaned_scans:
                db.delete(s)

        # 3. Audit Orphaned Findings (scan_id not matching any Scan)
        scan_ids = [s.id for s in db.query(Scan.id).all()]
        orphaned_findings = db.query(Finding).filter(~Finding.scan_id.in_(scan_ids)).all() if scan_ids else db.query(Finding).all()
        logger.info(f"Found {len(orphaned_findings)} orphaned Finding records.")

        if not dry_run:
            for f in orphaned_findings:
                db.delete(f)

        if not dry_run:
            db.commit()
            logger.info("Cleanup successfully committed to database.")
        else:
            logger.info("Dry-run complete. No changes were saved to the database.")

        return {
            "duplicate_assets_found": deleted_assets_count,
            "orphaned_scans_found": len(orphaned_scans),
            "orphaned_findings_found": len(orphaned_findings),
            "dry_run": dry_run,
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error during database cleanup: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CyberGuardian AI Database Cleanup Script")
    parser.add_argument("--execute", action="store_true", help="Execute cleanup deletions (default is dry-run)")
    args = parser.parse_args()

    is_dry_run = not args.execute
    audit_and_cleanup(dry_run=is_dry_run)
