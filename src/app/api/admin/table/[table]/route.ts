import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function generateId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { table } = await params;
    const body = await request.json();

    // Add ID if not provided
    if (!body.id) {
      body.id = generateId();
    }

    // Add createdAt if not provided
    if (!body.createdAt) {
      body.createdAt = new Date();
    }

    try {
      let result: any;

      switch (table) {
        case 'User':
          result = await prisma.user.create({
            data: {
              id: body.id,
              name: body.name || 'New User',
              username: body.username || `user_${Date.now()}`,
              passwordHash: body.passwordHash || '',
              role: body.role || 'Assessor',
              totalPoints: body.totalPoints || 0,
              dailyPointStreak: body.dailyPointStreak || 0,
              confidenceInfluencer: body.confidenceInfluencer || false,
            },
          });
          break;
        case 'ProcessArea':
          result = await prisma.processArea.create({
            data: {
              id: body.id,
              name: body.name || 'New Process Area',
              description: body.description || null,
              standard: body.standard || null,
              pId: body.pId || null,
            },
          });
          break;
        case 'SubProcess':
          result = await prisma.subProcess.create({
            data: {
              id: body.id,
              name: body.name || 'New Sub Process',
              description: body.description || null,
              processAreaId: body.processAreaId,
            },
          });
          break;
        case 'Control':
          result = await prisma.control.create({
            data: {
              id: body.id,
              sourceFile: body.sourceFile || null,
              controlRef: body.controlRef || null,
              practiceDocument: body.practiceDocument || null,
              name: body.name || 'New Control',
              statement: body.statement || '',
              controlType: body.controlType || 'Procedural',
              controlTypeDetail: body.controlTypeDetail || null,
              processAreaId: body.processAreaId,
              subProcessId: body.subProcessId,
              isHsseCritical: body.isHsseCritical || false,
              csfWho: body.csfWho || null,
              csfWhat: body.csfWhat || null,
              csfWhen: body.csfWhen || null,
              csfWhere: body.csfWhere || null,
              csfWhy: body.csfWhy || null,
              csfHow: body.csfHow || null,
              csfEvidence: body.csfEvidence || null,
              keyActivities: body.keyActivities || null,
              riskAddressed: body.riskAddressed || null,
              testingApproach: body.testingApproach || null,
              uncertainFlags: body.uncertainFlags || null,
              ramRating: body.ramRating || null,
              riskWeight: body.riskWeight || 1,
              rawHealthScore: body.rawHealthScore || 80,
              lastTestedDate: body.lastTestedDate || null,
              lastTestResult: body.lastTestResult || null,
            },
          });
          break;
        case 'Assessment':
          result = await prisma.assessment.create({
            data: {
              id: body.id,
              activityTypeId: body.activityTypeId,
              name: body.name || 'New Assessment',
              assessorId: body.assessorId || session.user.id,
              startDate: body.startDate ? new Date(body.startDate) : new Date(),
              endDate: body.endDate ? new Date(body.endDate) : null,
              loa: body.loa || 'FirstLine',
              status: body.status || 'Planned',
            },
          });
          break;
        case 'Sample':
          result = await prisma.sample.create({
            data: {
              id: body.id,
              assessmentId: body.assessmentId,
              sampleTypeId: body.sampleTypeId || null,
              recordSourceId: body.recordSourceId || null,
              recordReference: body.recordReference || null,
              comment: body.comment || null,
              status: body.status || 'NotTested',
              conclusion: body.conclusion || null,
              evidenceUrl: body.evidenceUrl || null,
            },
          });
          break;
        case 'ControlAssignment':
          if (!body.assessmentId || !body.controlId) {
            return NextResponse.json(
              { error: 'assessmentId and controlId are required' },
              { status: 400 }
            );
          }
          {
            const effectiveValue =
              body.effective === 'Effective' || body.effective === 'NotEffective'
                ? body.effective
                : null;
            result = await prisma.controlAssignment.create({
              data: {
                id: body.id,
                assessmentId: body.assessmentId,
                controlId: body.controlId,
                effective: effectiveValue,
                effectiveUpdatedAt: effectiveValue ? new Date() : null,
              },
            });
          }
          break;
        case 'AssuranceActivityType':
          result = await prisma.assuranceActivityType.create({
            data: {
              id: body.id,
              name: body.name || 'New Activity Type',
              description: body.description || null,
              defaultLOA: body.defaultLOA || 'FirstLine',
            },
          });
          break;
        default:
          return NextResponse.json({ error: 'Table not found' }, { status: 404 });
      }

      return NextResponse.json(result, { status: 201 });
    } catch (dbError: any) {
      return NextResponse.json(
        { error: dbError.message || 'Database error' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error creating row:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
