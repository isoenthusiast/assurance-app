UPDATE ControlAssignment SET effective = NULL, effectiveUpdatedAt = NULL WHERE effective NOT IN ('Effective', 'NotEffective');
